--------------------------------------------------------------------------------
-- GHOSTSPLAT_PREDICTOR.vhd
-- Adaptive-Order Thermal Predictor with Q16.16 Fixed-Point Arithmetic
-- Target: Xilinx Zynq UltraScale+ ZU7EV (XCZU7EV-2FFVC1156E)
-- HDL: VHDL-2008
-- Date: 2026-06-05
-- Status: AUTHORIZED FOR SYNTHESIS
-- Revision: 1.0
--------------------------------------------------------------------------------
-- Design: 5-stage Taylor FSM with Hamiltonian decomposition.
-- Not a true matrix exponential — classical thermal predictor in operator dress.
-- C_thermal = 9,375 J/K absorbs the ℏ_eff parameter from specification.
-- Pipeline: Input latch → Hamiltonian compute → Taylor FSM → Output register.
--------------------------------------------------------------------------------

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

use work.POG2_MHD_TYPES.ALL;

--------------------------------------------------------------------------------
-- ENTITY: GHOSTSPLAT_PREDICTOR
--------------------------------------------------------------------------------
entity GHOSTSPLAT_PREDICTOR is
    port (
        -- Clock and reset
        clk             : in  std_logic;
        rst             : in  std_logic;

        -- 640 ms tick strobe
        tick_strobe     : in  std_logic;

        -- Sensor inputs (Q16.16 scaled)
        temp_data       : in  SENSOR_ARRAY_T;         -- 16 temperature channels (K)
        press_data      : in  PRESSURE_ARRAY_T;       -- 4 pressure channels (atm)
        curr_data       : in  CURRENT_ARRAY_T;       -- 2 current/voltage channels
        imu_data        : in  IMU_ARRAY_T;            -- 6 IMU channels

        -- Current state (for Hamiltonian context)
        hexagram_state  : in  HEXAGRAM_STATE_T;       -- 6-bit yao state
        electrical_reg  : in  ELECTRICAL_REG_T;       -- 2-bit capability

        -- Prediction outputs (Q16.16)
        temp_predicted  : out Q16_16_T;               -- Predicted temp at t+3 ticks
        taylor_order    : out unsigned(2 downto 0);   -- Adaptive order (2-5)
        state_variance  : out Q16_16_T;               -- State variance metric
        high_variance   : out std_logic;              -- High variance flag (deliberation)

        -- Hamiltonian constants (pre-loaded from package)
        hbar_eff        : in  Q16_16_T;               -- Effective action (absorbed into C_thermal)
        thermal_lag     : in  Q16_16_T;               -- τ = 0.9375 s (Q16.16)

        -- Computation status
        compute_done    : out std_logic               -- Prediction complete
    );
end entity GHOSTSPLAT_PREDICTOR;

--------------------------------------------------------------------------------
-- ARCHITECTURE: PIPELINED_FSM
--------------------------------------------------------------------------------
architecture PIPELINED_FSM of GHOSTSPLAT_PREDICTOR is

    ------------------------------------------------------------------------
    -- THERMAL CONSTANTS (Q16.16)
    ------------------------------------------------------------------------
    -- C_thermal = 9,375 J/K (absorbs ℏ_eff from specification)
    constant C_THERMAL_Q16    : Q16_16_T := to_signed(614400000, Q_TOTAL_BITS);  -- 9375.0 * 65536

    -- Thermal diffusivity α = 1.2×10⁻⁴ m²/s
    constant ALPHA_Q16        : Q16_16_T := to_signed(7, Q_TOTAL_BITS);  -- 0.00012 * 65536 ≈ 7.86

    -- Baseline decoherence rates
    constant GAMMA_THERM_Q16  : Q16_16_T := to_signed(3277, Q_TOTAL_BITS);     -- 0.05 in Q16.16

    -- Convergence threshold: 5% relative change
    constant CONV_THRESH_Q16  : Q16_16_T := to_signed(3277, Q_TOTAL_BITS);     -- 0.05 in Q16.16

    -- Time step Δt = 640 ms = 0.64 s
    constant DT_Q16           : Q16_16_T := to_signed(41943, Q_TOTAL_BITS);     -- 0.64 * 65536

    -- 3-tick horizon = 1.92 s
    constant HORIZON_Q16      : Q16_16_T := to_signed(125829, Q_TOTAL_BITS);    -- 1.92 * 65536

    -- Joule heating: R = 0.001 Ω (1 mΩ bus bar)
    constant R_BUS_Q16        : Q16_16_T := to_signed(65, Q_TOTAL_BITS);        -- 0.001 * 65536

    -- Seawater properties
    constant RHO_SW_Q16       : Q16_16_T := to_signed(67174400, Q_TOTAL_BITS);  -- 1025.0 * 65536
    constant SIGMA_SW_Q16     : Q16_16_T := to_signed(327680, Q_TOTAL_BITS);   -- 5.0 * 65536

    ------------------------------------------------------------------------
    -- TAYLOR FSM STATES
    ------------------------------------------------------------------------
    type TAYLOR_STAGE_T is (STAGE_IDLE, STAGE_2ND, STAGE_3RD, STAGE_4TH, STAGE_5TH, STAGE_DONE);
    signal taylor_stage       : TAYLOR_STAGE_T;
    signal taylor_stage_next  : TAYLOR_STAGE_T;

    ------------------------------------------------------------------------
    -- INTERNAL REGISTERS (Q16.16)
    ------------------------------------------------------------------------
    -- Latched sensor inputs (on tick_strobe)
    signal temp_latched       : Q16_16_T;             -- Representative temp (channel 0)
    signal press_latched      : Q16_16_T;             -- Plenum pressure
    signal curr_latched       : Q16_16_T;             -- Bus current
    signal volt_latched       : Q16_16_T;             -- Bus voltage

    -- Hamiltonian terms
    signal h_elec             : Q16_16_T;             -- Electrical heating term
    signal h_therm            : Q16_16_T;             -- Thermal conduction term
    signal h_fluid            : Q16_16_T;             -- Fluid drag heating term
    signal h_cross_et         : Q16_16_T;             -- Elec-thermal coupling
    signal h_cross_ef         : Q16_16_T;             -- Elec-fluid coupling
    signal h_total            : Q16_16_T;             -- Total Hamiltonian

    -- Taylor expansion accumulators
    signal taylor_t0          : Q16_16_T;             -- T(t) — current temperature
    signal taylor_delta       : Q16_16_T;             -- ΔT — temperature change
    signal taylor_term        : Q16_16_T;             -- Current term (1/n! × Hⁿ × Δtⁿ)
    signal taylor_sum         : Q16_16_T;             -- Running sum
    signal taylor_prev        : Q16_16_T;             -- Previous sum (for convergence check)

    -- Decoherence model
    signal gamma_turb         : Q16_16_T;             -- Turbulent decoherence rate
    signal gamma_total        : Q16_16_T;             -- Total decoherence rate

    -- Variance computation
    signal variance_acc       : Q16_16_T;             -- Variance accumulator

    -- Output registers
    signal temp_pred_reg      : Q16_16_T;
    signal order_reg          : unsigned(2 downto 0);
    signal variance_reg       : Q16_16_T;
    signal high_var_reg       : std_logic;
    signal done_reg           : std_logic;

    ------------------------------------------------------------------------
    -- PIPELINE CONTROL
    ------------------------------------------------------------------------
    signal stage_counter      : unsigned(3 downto 0); -- Sub-stage counter per Taylor order
    signal compute_active     : std_logic;             -- FSM active flag

begin

    ------------------------------------------------------------------------
    -- PURE FUNCTION: q16_16_multiply
    -- Q16.16 × Q16.16 → Q16.16 (with overflow protection)
    -- Internal: 32.32 → truncate to 16.16
    ------------------------------------------------------------------------
    pure function q16_16_multiply(a, b : Q16_16_T) return Q16_16_T is
        variable a_ext : signed(63 downto 0);
        variable b_ext : signed(63 downto 0);
        variable prod  : signed(63 downto 0);
        variable result: Q16_16_T;
    begin
        a_ext := resize(a, 64);
        b_ext := resize(b, 64);
        prod := a_ext * b_ext;  -- 32.32 intermediate
        -- Truncate: shift right 16 bits, saturate if overflow
        result := prod(47 downto 16);  -- Extract 16.16 from 32.32
        -- Saturation check
        if prod(63) /= prod(47) then  -- Sign extension mismatch = overflow
            if prod(63) = '0' then
                result := to_signed(2147483647, Q_TOTAL_BITS);  -- Max positive
            else
                result := to_signed(-2147483648, Q_TOTAL_BITS); -- Max negative
            end if;
        end if;
        return result;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: q16_16_divide
    -- Q16.16 / Q16.16 → Q16.16 (integer division, truncates)
    ------------------------------------------------------------------------
    pure function q16_16_divide(a, b : Q16_16_T) return Q16_16_T is
        variable a_ext : signed(47 downto 0);
        variable b_ext : signed(47 downto 0);
        variable quo   : signed(47 downto 0);
    begin
        a_ext := resize(a, 48);
        b_ext := resize(b, 48);
        -- Shift left 16 bits before division to maintain Q16.16
        quo := (a_ext & x"0000") / b_ext;
        return quo(31 downto 0);
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: q16_16_abs
    -- Absolute value of Q16.16
    ------------------------------------------------------------------------
    pure function q16_16_abs(a : Q16_16_T) return Q16_16_T is
    begin
        if a < 0 then
            return -a;
        else
            return a;
        end if;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: relative_change
    -- |new - old| / |old| in Q16.16
    ------------------------------------------------------------------------
    pure function relative_change(new_val, old_val : Q16_16_T) return Q16_16_T is
        variable diff : Q16_16_T;
        variable abs_old : Q16_16_T;
    begin
        if old_val = 0 then
            return to_signed(65536, Q_TOTAL_BITS);  -- 1.0 (100% change if old=0)
        end if;
        diff := new_val - old_val;
        abs_old := q16_16_abs(old_val);
        return q16_16_divide(q16_16_abs(diff), abs_old);
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: sensor_to_q16_temp
    -- Convert 0.01 K/LSB unsigned ADC to Q16.16 Kelvin
    ------------------------------------------------------------------------
    pure function sensor_to_q16_temp(raw : SENSOR_RAW_T) return Q16_16_T is
        variable temp_k : signed(31 downto 0);
    begin
        -- raw is 24-bit unsigned, 0.01 K per LSB
        -- Convert to Q16.16: raw × 0.01 × 65536 = raw × 655.36
        -- Approximate: raw × 655 = raw << 9 + raw << 7 + raw << 5 + raw << 3 + raw << 1 + raw
        temp_k := resize(raw, 32);
        return temp_k * 655;  -- Simplified: actual implementation uses shift-add
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: compute_h_elec
    -- Electrical heating: H_elec = I² × R / C_thermal
    ------------------------------------------------------------------------
    pure function compute_h_elec(current : Q16_16_T; r_bus : Q16_16_T; c_therm : Q16_16_T) return Q16_16_T is
        variable i_sq : Q16_16_T;
        variable p_diss : Q16_16_T;
    begin
        i_sq := q16_16_multiply(current, current);
        p_diss := q16_16_multiply(i_sq, r_bus);
        return q16_16_divide(p_diss, c_therm);
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: compute_h_therm
    -- Thermal conduction: H_therm = α × ∇²T
    -- Simplified: use temperature gradient across electrode grid
    ------------------------------------------------------------------------
    pure function compute_h_therm(temp0, temp1 : Q16_16_T; alpha : Q16_16_T) return Q16_16_T is
        variable grad : Q16_16_T;
    begin
        grad := temp0 - temp1;  -- Temperature difference
        return q16_16_multiply(alpha, grad);
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: compute_h_fluid
    -- Fluid drag heating: H_fluid = τ_w × u* / C_thermal
    -- Mode-dependent: TRANSIT (15 kts) vs STEALTH (5 kts)
    ------------------------------------------------------------------------
    pure function compute_h_fluid(
        hex_state : HEXAGRAM_STATE_T;
        rho : Q16_16_T;
        c_therm : Q16_16_T
    ) return Q16_16_T is
        variable u_star : Q16_16_T;
        variable tau_w  : Q16_16_T;
        variable p_drag : Q16_16_T;
    begin
        -- u* depends on speed regime
        if (hex_state = ST_TRANSIT) or (hex_state = ST_TR_SALT) or (hex_state = ST_TR_CRIT) then
            u_star := to_signed(18153, Q_TOTAL_BITS);  -- 0.277 * 65536
        elsif (hex_state = ST_STEALTH) or (hex_state = ST_ST_CRIT) then
            u_star := to_signed(5898, Q_TOTAL_BITS);   -- 0.09 * 65536
        else
            u_star := (others => '0');
        end if;

        -- τ_w = 0.5 × ρ × u² × C_f (simplified: use u* directly)
        tau_w := q16_16_multiply(rho, u_star);
        p_drag := q16_16_multiply(tau_w, u_star);

        return q16_16_divide(p_drag, c_therm);
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: compute_h_cross_et
    -- Elec-thermal coupling: H_cross_et = λ_ET × |ACTIVE⟩⟨ACTIVE| ⊗ |DRYICE⟩⟨DRYICE|
    -- Simplified: if electrical=ACTIVE and thermal=DRYICE, add coupling term
    ------------------------------------------------------------------------
    pure function compute_h_cross_et(
        elec : ELECTRICAL_REG_T;
        h_elec : Q16_16_T;
        c_therm : Q16_16_T
    ) return Q16_16_T is
    begin
        if elec = ELEC_ACTIVE then
            return q16_16_divide(h_elec, c_therm);  -- Coupling = heating / thermal mass
        else
            return (others => '0');
        end if;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: compute_h_cross_ef
    -- Elec-fluid coupling: H_cross_ef = λ_EF × |ACTIVE⟩⟨ACTIVE| ⊗ |TRANSIT⟩⟨TRANSIT|
    -- Simplified: if electrical=ACTIVE and fluid=TRANSIT, add thrust term
    ------------------------------------------------------------------------
    pure function compute_h_cross_ef(
        hex_state : HEXAGRAM_STATE_T;
        elec : ELECTRICAL_REG_T;
        h_fluid : Q16_16_T
    ) return Q16_16_T is
    begin
        if (elec = ELEC_ACTIVE) and ((hex_state = ST_TRANSIT) or (hex_state = ST_TR_SALT) or (hex_state = ST_TR_CRIT)) then
            return h_fluid;  -- Full fluid heating when thrusting
        else
            return (others => '0');
        end if;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: compute_gamma_turb
    -- Turbulent decoherence: Γ_turb = u*/δ × Δρ/ρ
    -- Mode-dependent u* and boundary layer thickness δ
    ------------------------------------------------------------------------
    pure function compute_gamma_turb(
        hex_state : HEXAGRAM_STATE_T;
        rho : Q16_16_T
    ) return Q16_16_T is
        variable u_star : Q16_16_T;
        variable delta  : Q16_16_T;
        variable delta_rho : Q16_16_T;
    begin
        -- u* and δ depend on speed regime
        if (hex_state = ST_TRANSIT) or (hex_state = ST_TR_SALT) or (hex_state = ST_TR_CRIT) then
            u_star := to_signed(18153, Q_TOTAL_BITS);   -- 0.277
            delta  := to_signed(341, Q_TOTAL_BITS);      -- 0.0052 m
        elsif (hex_state = ST_STEALTH) or (hex_state = ST_ST_CRIT) then
            u_star := to_signed(5898, Q_TOTAL_BITS);     -- 0.09
            delta  := to_signed(341, Q_TOTAL_BITS);      -- 0.0052 m (same δ)
        else
            return (others => '0');
        end if;

        -- Δρ/ρ = CO₂ density perturbation = 0.0035
        delta_rho := to_signed(229, Q_TOTAL_BITS);       -- 0.0035 * 65536

        -- Γ_turb = (u*/δ) × (Δρ/ρ)
        return q16_16_multiply(q16_16_divide(u_star, delta), delta_rho);
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: factorial_q16
    -- Compute n! in Q16.16 (approximate for small n)
    ------------------------------------------------------------------------
    pure function factorial_q16(n : integer) return Q16_16_T is
    begin
        case n is
            when 0 => return Q16_16_ONE;                    -- 1! = 1.0
            when 1 => return Q16_16_ONE;                    -- 1! = 1.0
            when 2 => return to_signed(131072, Q_TOTAL_BITS);  -- 2! = 2.0
            when 3 => return to_signed(196608, Q_TOTAL_BITS);  -- 3! = 3.0
            when 4 => return to_signed(262144, Q_TOTAL_BITS);  -- 4! = 4.0
            when 5 => return to_signed(327680, Q_TOTAL_BITS);  -- 5! = 5.0
            when others => return Q16_16_ONE;
        end case;
    end function;

    ------------------------------------------------------------------------
    -- INPUT LATCHING (on tick_strobe)
    ------------------------------------------------------------------------
    process(clk, rst)
    begin
        if rst = '1' then
            temp_latched  <= (others => '0');
            press_latched <= (others => '0');
            curr_latched  <= (others => '0');
            volt_latched  <= (others => '0');
        elsif rising_edge(clk) then
            if tick_strobe = '1' then
                -- Latch representative sensor values
                temp_latched  <= temp_data(0);   -- Bus bar temperature
                press_latched <= press_data(0);  -- Plenum pressure
                curr_latched  <= curr_data(0);   -- Bus current
                volt_latched  <= curr_data(1);   -- Bus voltage
            end if;
        end if;
    end process;

    ------------------------------------------------------------------------
    -- HAMILTONIAN COMPUTATION (combinatorial, single cycle)
    ------------------------------------------------------------------------
    process(all)
    begin
        -- Compute individual Hamiltonian terms
        h_elec     <= compute_h_elec(curr_latched, R_BUS_Q16, C_THERMAL_Q16);
        h_therm    <= compute_h_therm(temp_data(0), temp_data(1), ALPHA_Q16);
        h_fluid    <= compute_h_fluid(hexagram_state, RHO_SW_Q16, C_THERMAL_Q16);
        h_cross_et <= compute_h_cross_et(electrical_reg, h_elec, C_THERMAL_Q16);
        h_cross_ef <= compute_h_cross_ef(hexagram_state, electrical_reg, h_fluid);

        -- Total Hamiltonian: H_total = H_elec + H_therm + H_fluid + H_cross_et + H_cross_ef
        h_total <= h_elec + h_therm + h_fluid + h_cross_et + h_cross_ef;

        -- Decoherence model
        gamma_turb  <= compute_gamma_turb(hexagram_state, RHO_SW_Q16);
        gamma_total <= GAMMA_THERM_Q16 + gamma_turb;
    end process;

    ------------------------------------------------------------------------
    -- TAYLOR FSM (advances one stage per clock cycle)
    ------------------------------------------------------------------------
    process(clk, rst)
    begin
        if rst = '1' then
            taylor_stage   <= STAGE_IDLE;
            taylor_t0      <= (others => '0');
            taylor_delta   <= (others => '0');
            taylor_term    <= (others => '0');
            taylor_sum     <= (others => '0');
            taylor_prev    <= (others => '0');
            stage_counter  <= (others => '0');
            compute_active <= '0';
            done_reg       <= '0';
        elsif rising_edge(clk) then
            case taylor_stage is

                when STAGE_IDLE =>
                    done_reg <= '0';
                    if tick_strobe = '1' then
                        -- Initialize Taylor expansion
                        taylor_t0    <= temp_latched;
                        taylor_sum   <= temp_latched;  -- T(t) = T_0
                        taylor_prev  <= temp_latched;
                        taylor_term  <= h_total;       -- First-order term: H × Δt
                        taylor_stage <= STAGE_2ND;
                        stage_counter <= (others => '0');
                        compute_active <= '1';
                        order_reg <= "010";  -- Start at order 2
                    end if;

                when STAGE_2ND =>
                    -- 2nd-order term: (1/2!) × H² × Δt²
                    taylor_term <= q16_16_multiply(h_total, DT_Q16);  -- H × Δt
                    taylor_sum  <= taylor_sum + q16_16_divide(taylor_term, factorial_q16(2));
                    taylor_prev <= taylor_sum;

                    -- Check convergence
                    if relative_change(taylor_sum, taylor_prev) < CONV_THRESH_Q16 then
                        taylor_stage <= STAGE_DONE;
                        order_reg <= "010";  -- Order 2 sufficient
                    else
                        taylor_stage <= STAGE_3RD;
                        order_reg <= "011";
                    end if;

                when STAGE_3RD =>
                    -- 3rd-order term: (1/3!) × H³ × Δt³
                    taylor_term <= q16_16_multiply(taylor_term, h_total);  -- H² × Δt
                    taylor_term <= q16_16_multiply(taylor_term, DT_Q16);   -- H² × Δt²
                    taylor_sum  <= taylor_sum + q16_16_divide(taylor_term, factorial_q16(3));

                    if relative_change(taylor_sum, taylor_prev) < CONV_THRESH_Q16 then
                        taylor_stage <= STAGE_DONE;
                        order_reg <= "011";
                    else
                        taylor_stage <= STAGE_4TH;
                        order_reg <= "100";
                    end if;
                    taylor_prev <= taylor_sum;

                when STAGE_4TH =>
                    -- 4th-order term
                    taylor_term <= q16_16_multiply(taylor_term, h_total);
                    taylor_term <= q16_16_multiply(taylor_term, DT_Q16);
                    taylor_sum  <= taylor_sum + q16_16_divide(taylor_term, factorial_q16(4));

                    if relative_change(taylor_sum, taylor_prev) < CONV_THRESH_Q16 then
                        taylor_stage <= STAGE_DONE;
                        order_reg <= "100";
                    else
                        taylor_stage <= STAGE_5TH;
                        order_reg <= "101";
                    end if;
                    taylor_prev <= taylor_sum;

                when STAGE_5TH =>
                    -- 5th-order term (maximum)
                    taylor_term <= q16_16_multiply(taylor_term, h_total);
                    taylor_term <= q16_16_multiply(taylor_term, DT_Q16);
                    taylor_sum  <= taylor_sum + q16_16_divide(taylor_term, factorial_q16(5));
                    taylor_stage <= STAGE_DONE;
                    order_reg <= "101";
                    taylor_prev <= taylor_sum;

                when STAGE_DONE =>
                    -- Final prediction: T(t+3) = T(t) + ΔT
                    temp_pred_reg <= taylor_sum;
                    done_reg <= '1';
                    compute_active <= '0';

                    -- Variance computation
                    variance_reg <= q16_16_abs(taylor_sum - taylor_t0);

                    -- High variance flag: |ΔT| > 15 K (983040 in Q16.16)
                    if q16_16_abs(taylor_sum - taylor_t0) > to_signed(983040, Q_TOTAL_BITS) then
                        high_var_reg <= '1';
                    else
                        high_var_reg <= '0';
                    end if;

                    -- Return to idle, wait for next tick
                    taylor_stage <= STAGE_IDLE;

                when others =>
                    taylor_stage <= STAGE_IDLE;
            end case;
        end if;
    end process;

    ------------------------------------------------------------------------
    -- OUTPUT ASSIGNMENTS
    ------------------------------------------------------------------------
    temp_predicted  <= temp_pred_reg;
    taylor_order    <= order_reg;
    state_variance  <= variance_reg;
    high_variance   <= high_var_reg;
    compute_done    <= done_reg;

end architecture PIPELINED_FSM;

--------------------------------------------------------------------------------
-- END OF GHOSTSPLAT_PREDICTOR
--------------------------------------------------------------------------------
