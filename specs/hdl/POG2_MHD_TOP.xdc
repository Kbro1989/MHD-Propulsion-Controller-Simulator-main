###############################################################################
# POG2-MHD-PROP-001 Rev 1.0 — CORRECTED
# POG2_MHD_TOP.xdc
# Timing and physical constraints for Zynq UltraScale+ ZU7EV
# Matched to POG2_MHD_FPGA_TOP.vhd entity declaration (SPI sensors, not bus)
# 640 ms canonical tick, 250 MHz PL, 100 MHz AXI
###############################################################################

#=============================================================================
# CLOCK DEFINITIONS
#=============================================================================

# PL fabric clock: 250 MHz (4ns period)
create_clock -period 4.000 -name clk_250mhz [get_ports clk_250mhz]
set_property IOSTANDARD LVCMOS18 [get_ports clk_250mhz]
set_property PACKAGE_PIN H13 [get_ports clk_250mhz]  ;# Bank 66, CCIO

# AXI clock from PS: 100 MHz (10ns period)
create_clock -period 10.000 -name axi_aclk [get_ports axi_aclk]
set_property IOSTANDARD LVCMOS18 [get_ports axi_aclk]
set_property PACKAGE_PIN H14 [get_ports axi_aclk]  ;# Bank 66

#=============================================================================
# RESETS (async, active-low)
#=============================================================================
set_property IOSTANDARD LVCMOS18 [get_ports reset_n_250]
set_property PACKAGE_PIN J13 [get_ports reset_n_250]
set_property IOSTANDARD LVCMOS18 [get_ports reset_n_axi]
set_property PACKAGE_PIN J14 [get_ports reset_n_axi]

# False path for reset synchronizer (metastability is expected and handled)
set_false_path -from [get_ports reset_n_250] -to [all_clocks]
set_false_path -from [get_ports reset_n_axi] -to [all_clocks]

#=============================================================================
# CLOCK DOMAIN CROSSING (CDC) PATHS
# AXI (100MHz) <-> PL (250MHz)
#=============================================================================

# Data & Control signals: Three-stage synchronizers with ASYNC_REG are used.
# We replace unsafe, unconstrained set_false_path assertions for asynchronous crossings
# with robust, bounded-delay max delay constraints to minimize latency and eliminate skew.
set_max_delay -from [get_clocks axi_aclk] -to [get_clocks clk_250mhz] -datapath_only 4.000
set_max_delay -from [get_clocks clk_250mhz] -to [get_clocks axi_aclk] -datapath_only 10.000

#=============================================================================
# MULTICYCLE PATHS
#=============================================================================

# Tick generator: 150M cycle counter, relaxed timing
set_multicycle_path -setup 2 -from [get_cells tick_counter_reg] -to [get_cells tick_strobe_reg]
set_multicycle_path -hold 1 -from [get_cells tick_counter_reg] -to [get_cells tick_strobe_reg]

# GhostSplat Taylor FSM: 20-200ns per stage, 2-cycle pipeline
set_multicycle_path -setup 2 -from [get_cells -hierarchical -filter {NAME =~ *taylor_state*}]     -to [get_cells -hierarchical -filter {NAME =~ *taylor_sum*}]

# Contactor sequencer: 15ms mechanical delay, extremely relaxed
set_multicycle_path -setup 3750 -from [get_cells -hierarchical -filter {NAME =~ *U_CONTACTOR*}]     -to [get_cells -hierarchical -filter {NAME =~ *contactor_state*}]
set_multicycle_path -hold 1875 -from [get_cells -hierarchical -filter {NAME =~ *U_CONTACTOR*}]     -to [get_cells -hierarchical -filter {NAME =~ *contactor_state*}]

#=============================================================================
# CRITICAL TIMING PATHS (from build status)
#=============================================================================

# IMU → HexagramSM: <12ns (highest priority)
set_max_delay -datapath_only 12.000 -from [get_ports imu_irq]     -to [get_cells -hierarchical -filter {NAME =~ *hex_state_next*}]

# GhostSplat Taylor FSM: 20-200ns adaptive
set_max_delay -datapath_only 200.000 -from [get_cells -hierarchical -filter {NAME =~ *h_total*}]     -to [get_cells -hierarchical -filter {NAME =~ *taylor_sum*}]

# Choke driver NCO: 4ns (single clock cycle)
set_max_delay -datapath_only 4.000 -from [get_cells -hierarchical -filter {NAME =~ *nco_phase*}]     -to [get_cells -hierarchical -filter {NAME =~ *pwm_match*}]

# AXI4-Lite register access: 10ns (single AXI clock)
set_max_delay -datapath_only 10.000 -from [get_ports axi_araddr]     -to [get_ports axi_rdata]

#=============================================================================
# I/O PIN ASSIGNMENTS (ZU7EV, Bank 66-67, LVCMOS18)
#=============================================================================

# Sensor inputs (SPI/ADC)
set_property IOSTANDARD LVCMOS18 [get_ports sensor_temp_bus*]
set_property PACKAGE_PIN K13 [get_ports sensor_temp_bus[0]]
set_property PACKAGE_PIN K14 [get_ports sensor_temp_bus[1]]
set_property PACKAGE_PIN L13 [get_ports sensor_temp_bus[2]]
set_property PACKAGE_PIN L14 [get_ports sensor_temp_bus[3]]
set_property PACKAGE_PIN M13 [get_ports sensor_temp_bus[4]]
set_property PACKAGE_PIN M14 [get_ports sensor_temp_bus[5]]
set_property PACKAGE_PIN N13 [get_ports sensor_temp_bus[6]]
set_property PACKAGE_PIN N14 [get_ports sensor_temp_bus[7]]
set_property PACKAGE_PIN P13 [get_ports sensor_temp_bus[8]]
set_property PACKAGE_PIN P14 [get_ports sensor_temp_bus[9]]
set_property PACKAGE_PIN R13 [get_ports sensor_temp_bus[10]]
set_property PACKAGE_PIN R14 [get_ports sensor_temp_bus[11]]
set_property PACKAGE_PIN T13 [get_ports sensor_temp_bus[12]]
set_property PACKAGE_PIN T14 [get_ports sensor_temp_bus[13]]
set_property PACKAGE_PIN U13 [get_ports sensor_temp_bus[14]]
set_property PACKAGE_PIN U14 [get_ports sensor_temp_bus[15]]

set_property IOSTANDARD LVCMOS18 [get_ports sensor_temp_electrode*]
set_property PACKAGE_PIN V13 [get_ports sensor_temp_electrode[0]]
set_property PACKAGE_PIN V14 [get_ports sensor_temp_electrode[1]]
set_property PACKAGE_PIN W13 [get_ports sensor_temp_electrode[2]]
set_property PACKAGE_PIN W14 [get_ports sensor_temp_electrode[3]]
set_property PACKAGE_PIN Y13 [get_ports sensor_temp_electrode[4]]
set_property PACKAGE_PIN Y14 [get_ports sensor_temp_electrode[5]]
set_property PACKAGE_PIN AA13 [get_ports sensor_temp_electrode[6]]
set_property PACKAGE_PIN AA14 [get_ports sensor_temp_electrode[7]]
set_property PACKAGE_PIN AB13 [get_ports sensor_temp_electrode[8]]
set_property PACKAGE_PIN AB14 [get_ports sensor_temp_electrode[9]]
set_property PACKAGE_PIN AC13 [get_ports sensor_temp_electrode[10]]
set_property PACKAGE_PIN AC14 [get_ports sensor_temp_electrode[11]]
set_property PACKAGE_PIN AD13 [get_ports sensor_temp_electrode[12]]
set_property PACKAGE_PIN AD14 [get_ports sensor_temp_electrode[13]]
set_property PACKAGE_PIN AE13 [get_ports sensor_temp_electrode[14]]
set_property PACKAGE_PIN AE14 [get_ports sensor_temp_electrode[15]]

set_property IOSTANDARD LVCMOS18 [get_ports sensor_press_plenum*]
set_property PACKAGE_PIN AF13 [get_ports sensor_press_plenum[0]]
set_property PACKAGE_PIN AF14 [get_ports sensor_press_plenum[1]]
set_property PACKAGE_PIN AG13 [get_ports sensor_press_plenum[2]]
set_property PACKAGE_PIN AG14 [get_ports sensor_press_plenum[3]]
set_property PACKAGE_PIN AH13 [get_ports sensor_press_plenum[4]]
set_property PACKAGE_PIN AH14 [get_ports sensor_press_plenum[5]]
set_property PACKAGE_PIN AI13 [get_ports sensor_press_plenum[6]]
set_property PACKAGE_PIN AI14 [get_ports sensor_press_plenum[7]]
set_property PACKAGE_PIN AJ13 [get_ports sensor_press_plenum[8]]
set_property PACKAGE_PIN AJ14 [get_ports sensor_press_plenum[9]]
set_property PACKAGE_PIN AK13 [get_ports sensor_press_plenum[10]]
set_property PACKAGE_PIN AK14 [get_ports sensor_press_plenum[11]]
set_property PACKAGE_PIN AL13 [get_ports sensor_press_plenum[12]]
set_property PACKAGE_PIN AL14 [get_ports sensor_press_plenum[13]]
set_property PACKAGE_PIN AM13 [get_ports sensor_press_plenum[14]]
set_property PACKAGE_PIN AM14 [get_ports sensor_press_plenum[15]]

set_property IOSTANDARD LVCMOS18 [get_ports sensor_curr_bus*]
set_property PACKAGE_PIN AN13 [get_ports sensor_curr_bus[0]]
set_property PACKAGE_PIN AN14 [get_ports sensor_curr_bus[1]]
set_property PACKAGE_PIN AP13 [get_ports sensor_curr_bus[2]]
set_property PACKAGE_PIN AP14 [get_ports sensor_curr_bus[3]]
set_property PACKAGE_PIN AR13 [get_ports sensor_curr_bus[4]]
set_property PACKAGE_PIN AR14 [get_ports sensor_curr_bus[5]]
set_property PACKAGE_PIN AT13 [get_ports sensor_curr_bus[6]]
set_property PACKAGE_PIN AT14 [get_ports sensor_curr_bus[7]]
set_property PACKAGE_PIN AU13 [get_ports sensor_curr_bus[8]]
set_property PACKAGE_PIN AU14 [get_ports sensor_curr_bus[9]]
set_property PACKAGE_PIN AV13 [get_ports sensor_curr_bus[10]]
set_property PACKAGE_PIN AV14 [get_ports sensor_curr_bus[11]]
set_property PACKAGE_PIN AW13 [get_ports sensor_curr_bus[12]]
set_property PACKAGE_PIN AW14 [get_ports sensor_curr_bus[13]]
set_property PACKAGE_PIN BA13 [get_ports sensor_curr_bus[14]]
set_property PACKAGE_PIN BA14 [get_ports sensor_curr_bus[15]]

set_property IOSTANDARD LVCMOS18 [get_ports sensor_imu_gamma*]
set_property PACKAGE_PIN BB13 [get_ports sensor_imu_gamma[0]]
set_property PACKAGE_PIN BB14 [get_ports sensor_imu_gamma[1]]
set_property PACKAGE_PIN BC13 [get_ports sensor_imu_gamma[2]]
set_property PACKAGE_PIN BC14 [get_ports sensor_imu_gamma[3]]
set_property PACKAGE_PIN BD13 [get_ports sensor_imu_gamma[4]]
set_property PACKAGE_PIN BD14 [get_ports sensor_imu_gamma[5]]
set_property PACKAGE_PIN BE13 [get_ports sensor_imu_gamma[6]]
set_property PACKAGE_PIN BE14 [get_ports sensor_imu_gamma[7]]
set_property PACKAGE_PIN BF13 [get_ports sensor_imu_gamma[8]]
set_property PACKAGE_PIN BF14 [get_ports sensor_imu_gamma[9]]
set_property PACKAGE_PIN BG13 [get_ports sensor_imu_gamma[10]]
set_property PACKAGE_PIN BG14 [get_ports sensor_imu_gamma[11]]
set_property PACKAGE_PIN BH13 [get_ports sensor_imu_gamma[12]]
set_property PACKAGE_PIN BH14 [get_ports sensor_imu_gamma[13]]
set_property PACKAGE_PIN BJ13 [get_ports sensor_imu_gamma[14]]
set_property PACKAGE_PIN BJ14 [get_ports sensor_imu_gamma[15]]

# IMU interrupt
set_property IOSTANDARD LVCMOS18 [get_ports imu_irq]
set_property PACKAGE_PIN BK13 [get_ports imu_irq]

# Gate drive outputs (5 channels × 2)
set_property IOSTANDARD LVCMOS18 [get_ports gate_h*]
set_property IOSTANDARD LVCMOS18 [get_ports gate_l*]
set_property DRIVE 12 [get_ports gate_h*]
set_property DRIVE 12 [get_ports gate_l*]
set_property SLEW FAST [get_ports gate_h*]
set_property SLEW FAST [get_ports gate_l*]
set_property PACKAGE_PIN BK14 [get_ports gate_h[0]]
set_property PACKAGE_PIN BL13 [get_ports gate_l[0]]
set_property PACKAGE_PIN BL14 [get_ports gate_h[1]]
set_property PACKAGE_PIN BM13 [get_ports gate_l[1]]
set_property PACKAGE_PIN BM14 [get_ports gate_h[2]]
set_property PACKAGE_PIN BN13 [get_ports gate_l[2]]
set_property PACKAGE_PIN BN14 [get_ports gate_h[3]]
set_property PACKAGE_PIN BP13 [get_ports gate_l[3]]
set_property PACKAGE_PIN BP14 [get_ports gate_h[4]]
set_property PACKAGE_PIN BR13 [get_ports gate_l[4]]

# Contactor I/O
set_property IOSTANDARD LVCMOS18 [get_ports contactor_cmd*]
set_property IOSTANDARD LVCMOS18 [get_ports contactor_state*]
set_property PACKAGE_PIN BR14 [get_ports contactor_cmd[0]]
set_property PACKAGE_PIN BT13 [get_ports contactor_cmd[1]]
set_property PACKAGE_PIN BT14 [get_ports contactor_cmd[2]]
set_property PACKAGE_PIN BU13 [get_ports contactor_cmd[3]]
set_property PACKAGE_PIN BU14 [get_ports contactor_cmd[4]]
set_property PACKAGE_PIN BV13 [get_ports contactor_cmd[5]]
set_property PACKAGE_PIN BV14 [get_ports contactor_cmd[6]]
set_property PACKAGE_PIN BW13 [get_ports contactor_cmd[7]]
set_property PACKAGE_PIN BW14 [get_ports contactor_cmd[8]]
set_property PACKAGE_PIN BX13 [get_ports contactor_cmd[9]]
set_property PACKAGE_PIN BX14 [get_ports contactor_state[0]]
set_property PACKAGE_PIN BY13 [get_ports contactor_state[1]]
set_property PACKAGE_PIN BY14 [get_ports contactor_state[2]]
set_property PACKAGE_PIN BZ13 [get_ports contactor_state[3]]
set_property PACKAGE_PIN BZ14 [get_ports contactor_state[4]]
set_property PACKAGE_PIN CA13 [get_ports contactor_state[5]]
set_property PACKAGE_PIN CA14 [get_ports contactor_state[6]]
set_property PACKAGE_PIN CB13 [get_ports contactor_state[7]]
set_property PACKAGE_PIN CB14 [get_ports contactor_state[8]]
set_property PACKAGE_PIN CC13 [get_ports contactor_state[9]]

# UART
set_property IOSTANDARD LVCMOS18 [get_ports uart_tx]
set_property IOSTANDARD LVCMOS18 [get_ports uart_rx]
set_property PACKAGE_PIN CC14 [get_ports uart_tx]
set_property PACKAGE_PIN CD13 [get_ports uart_rx]

# Status LEDs
set_property IOSTANDARD LVCMOS18 [get_ports led_heartbeat]
set_property IOSTANDARD LVCMOS18 [get_ports led_fault]
set_property IOSTANDARD LVCMOS18 [get_ports led_crit]
set_property DRIVE 8 [get_ports led_heartbeat]
set_property DRIVE 8 [get_ports led_fault]
set_property DRIVE 8 [get_ports led_crit]
set_property PACKAGE_PIN CD14 [get_ports led_heartbeat]
set_property PACKAGE_PIN CE13 [get_ports led_fault]
set_property PACKAGE_PIN CE14 [get_ports led_crit]

# Debug outputs
set_property IOSTANDARD LVCMOS18 [get_ports debug_hex_state*]
set_property IOSTANDARD LVCMOS18 [get_ports debug_tick_phase*]
set_property PACKAGE_PIN CF13 [get_ports debug_hex_state[0]]
set_property PACKAGE_PIN CF14 [get_ports debug_hex_state[1]]
set_property PACKAGE_PIN CG13 [get_ports debug_hex_state[2]]
set_property PACKAGE_PIN CG14 [get_ports debug_hex_state[3]]
set_property PACKAGE_PIN CH13 [get_ports debug_hex_state[4]]
set_property PACKAGE_PIN CH14 [get_ports debug_hex_state[5]]
set_property PACKAGE_PIN CJ13 [get_ports debug_tick_phase[0]]
set_property PACKAGE_PIN CJ14 [get_ports debug_tick_phase[1]]
set_property PACKAGE_PIN CK13 [get_ports debug_tick_phase[2]]
set_property PACKAGE_PIN CK14 [get_ports debug_tick_phase[3]]

#=============================================================================
# POWER AND CONFIGURATION
#=============================================================================
set_property CONFIG_VOLTAGE 1.8 [current_design]
set_property CFGBVS GND [current_design]

#=============================================================================
# TIMING EXCEPTIONS FOR ASYNCHRONOUS INPUTS
#=============================================================================
set_false_path -from [get_ports sensor_*] -to [get_clocks clk_250mhz]
set_false_path -from [get_ports imu_irq] -to [get_clocks clk_250mhz]
set_false_path -from [get_ports contactor_state*] -to [get_clocks clk_250mhz]
set_false_path -from [get_ports uart_rx] -to [get_clocks clk_250mhz]

#=============================================================================
# BITSTREAM CONFIGURATION
#=============================================================================
set_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]
set_property BITSTREAM.CONFIG.CONFIGRATE 85.0 [current_design]
set_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]
set_property BITSTREAM.CONFIG.UNUSEDPIN PULLUP [current_design]
