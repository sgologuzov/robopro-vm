/**
 * Robo Bot
 *
 * @overview Compared to the Arduino Uno, this control board use CH340 as
 * use to uart chip, uese oldbootloader to flash the firmware, and there are
 * more A6 and A7 pin options.
 */
const OpenBlockArduinoUnoDevice = require('../arduinoUno/arduinoUno');

const ArduinoPeripheral = require('../common/arduino-peripheral');
const formatMessage = require('format-message');
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const Timer = require('../../util/timer');
const Cast = require('../../util/cast');

/**
 * The list of USB device filters.
 * @readonly
 */
const PNPID_LIST = [
    // For chinese clones that use CH340
    'USB\\VID_2341&PID_0043'
];

/**
 * Configuration of serialport
 * @readonly
 */
const SERIAL_CONFIG = {
    baudRate: 57600,
    dataBits: 8,
    stopBits: 1
};

/**
 * Configuration for arduino-cli.
 * @readonly
 */
const DIVECE_OPT = {
    type: 'arduino',
    fqbn: 'arduino:avr:uno',
    firmware: 'arduinoUno.hex'
};

const Pins = {
    D0: '0',
    D1: '1',
    D2: '2',
    D3: '3',
    D4: '4',
    D5: '5',
    D6: '6',
    D7: '7',
    D8: '8',
    D9: '9',
    D10: '10',
    D11: '11',
    D12: '12',
    D13: '13',
    A0: 'A0',
    A1: 'A1',
    A2: 'A2',
    A3: 'A3',
    A4: 'A4',
    A5: 'A5'
};


const Level = {
    High: 'HIGH',
    Low: 'LOW'
};

const Mode = {
    Input: 'INPUT',
    Output: 'OUTPUT',
    InputPullup: 'INPUT_PULLUP'
};

const Direction = {
    Forward: 'FORWARD',
    Backward: 'BACKWARD'
};

const PinsMap = {
    // RoboPro
    LeftMotorReverse: Pins.D4,
    LeftMotorPwm: Pins.D5,
    RightMotorPwm: Pins.D6,
    RightMotorReverse: Pins.D7
    // Keyestudio
    /*
    LeftMotorReverse: Pins.D12,
    LeftMotorPwm: Pins.D3,
    RightMotorPwm: Pins.D11,
    RightMotorReverse: Pins.D13
     */
};

const MIN_MOTOR_POWER = 0;
const MAX_MOTOR_POWER = 255;
const DEGREE_RATIO = 20;

/**
 * Manage communication with a Arduino Nano peripheral over a OpenBlock Link client socket.
 */
class RoboProBot extends ArduinoPeripheral {
    /**
     * Construct a Arduino communication object.
     * @param {Runtime} runtime - the OpenBlock runtime
     * @param {string} deviceId - the id of the extension
     * @param {string} originalDeviceId - the original id of the peripheral, like xxx_arduinoUno
     */
    constructor (runtime, deviceId, originalDeviceId) {
        super(runtime, deviceId, originalDeviceId, PNPID_LIST, SERIAL_CONFIG, DIVECE_OPT);
    }
}

/**
 * OpenBlock blocks to interact with a Arduino Nano Ultra peripheral.
 */
class OpenBlockRoboProBotDevice extends OpenBlockArduinoUnoDevice {

    /**
     * @return {string} - the ID of this extension.
     */
    get DEVICE_ID () {
        return 'roboProBot';
    }

    get DIRECTIONS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'roboPro.directionsMenu.forward',
                    default: 'forward',
                    description: 'label for forward direction'
                }),
                value: Direction.Forward
            },
            {
                text: formatMessage({
                    id: 'roboPro.directionsMenu.backward',
                    default: 'backward',
                    description: 'label for backward direction'
                }),
                value: Direction.Backward
            }
        ];
    }

    /**
     * Construct a set of Arduino blocks.
     * @param {Runtime} runtime - the OpenBlock runtime.
     * @param {string} originalDeviceId - the original id of the peripheral, like xxx_arduinoUno
     */
    constructor (runtime, originalDeviceId) {
        super(runtime, originalDeviceId);

        // Create a new Arduino Nano peripheral instance
        this._peripheral = new RoboProBot(this.runtime, this.DEVICE_ID, originalDeviceId);
        this._peripheral.setPinMode(PinsMap.LeftMotorReverse, Mode.Output);
        this._peripheral.setPinMode(PinsMap.LeftMotorPwm, Mode.Output);
        this._peripheral.setPinMode(PinsMap.RightMotorReverse, Mode.Output);
        this._peripheral.setPinMode(PinsMap.RightMotorPwm, Mode.Output);

        this._directionRight = Direction.Forward;
        this._directionLeft = Direction.Forward;
        this._powerRight = MAX_MOTOR_POWER;
        this._powerLeft = MAX_MOTOR_POWER;
        this._motorsOnForSecondsTimeout = null;
    }

    /**
     * @returns {Array.<object>} metadata for this extension and its blocks.
     */
    getInfo () {
        return [
            {
                id: 'roboProBot',
                name: formatMessage({
                    id: 'roboPro.category.roboProBot',
                    default: 'RoboPro Bot',
                    description: 'The name of the arduino uno device pin category'
                }),
                color1: '#00AF41',
                color2: '#AAAAAA',
                color3: '#00AF41',

                blocks: [
                    {
                        opcode: 'motorsOnForSeconds',
                        text: formatMessage({
                            id: 'roboPro.bot.motorsOnForSeconds',
                            default: 'Motors on for [SECONDS] seconds',
                            description: 'roboProBot turn on motors'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            SECONDS: {
                                type: ArgumentType.NUMBER,
                                defaultValue: '1'
                            }
                        }
                    },
                    {
                        opcode: 'motorsOn',
                        text: formatMessage({
                            id: 'roboPro.bot.motorsOn',
                            default: 'Motors on',
                            description: 'Turn on motors'
                        }),
                        blockType: BlockType.COMMAND
                    },
                    {
                        opcode: 'motorsOff',
                        text: formatMessage({
                            id: 'roboPro.bot.motorsOff',
                            default: 'Motors off',
                            description: 'Turn off motors'
                        }),
                        blockType: BlockType.COMMAND
                    },
                    {
                        opcode: 'setDirectionTo',
                        text: formatMessage({
                            id: 'roboPro.bot.setDirectionTo',
                            default: 'Set robot direction to [DIRECTION]',
                            description: 'Set robot direction'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            DIRECTION: {
                                type: ArgumentType.STRING,
                                menu: 'directions',
                                defaultValue: Direction.Forward
                            }
                        }
                    },
                    {
                        opcode: 'turnRight',
                        text: formatMessage({
                            id: 'roboPro.bot.turnRight',
                            default: 'Turn right for [DEGREES] degrees',
                            description: 'Turn robot right'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            DEGREES: {
                                type: ArgumentType.ANGLE,
                                defaultValue: 15
                            }
                        }
                    },
                    {
                        opcode: 'turnLeft',
                        text: formatMessage({
                            id: 'roboPro.bot.turnLeft',
                            default: 'Turn left for [DEGREES] degrees',
                            description: 'Turn robot left'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            DEGREES: {
                                type: ArgumentType.ANGLE,
                                defaultValue: 15
                            }
                        }
                    },
                    {
                        opcode: 'setPowerAndDirection',
                        text: formatMessage({
                            id: 'roboPro.bot.setPowerAndDirection',
                            default: 'L [DIRECTION_LEFT] R [DIRECTION_RIGHT] set power ' +
                                'L [POWER_LEFT] R [POWER_RIGHT] %',
                            description: 'Set robot power and direction'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            DIRECTION_LEFT: {
                                type: ArgumentType.STRING,
                                menu: 'directions',
                                defaultValue: Direction.Forward
                            },
                            DIRECTION_RIGHT: {
                                type: ArgumentType.STRING,
                                menu: 'directions',
                                defaultValue: Direction.Forward
                            },
                            POWER_LEFT: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 30
                            },
                            POWER_RIGHT: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 30
                            }
                        }
                    },
                    {
                        opcode: 'setPinMode',
                        text: formatMessage({
                            id: 'arduinoUno.pins.setPinMode',
                            default: 'set pin [PIN] mode [MODE]',
                            description: 'arduinoUno set pin mode'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'pins',
                                defaultValue: Pins.D0
                            },
                            MODE: {
                                type: ArgumentType.STRING,
                                menu: 'mode',
                                defaultValue: Mode.Input
                            }
                        }
                    },
                    {
                        opcode: 'setDigitalOutput',
                        text: formatMessage({
                            id: 'arduinoUno.pins.setDigitalOutput',
                            default: 'set digital pin [PIN] out [LEVEL]',
                            description: 'arduinoUno set digital pin out'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'pins',
                                defaultValue: Pins.D0
                            },
                            LEVEL: {
                                type: ArgumentType.STRING,
                                menu: 'level',
                                defaultValue: Level.High
                            }
                        }
                    }
                ],
                menus: {
                    directions: {
                        items: this.DIRECTIONS_MENU
                    },
                    pins: {
                        items: this.PINS_MENU
                    },
                    mode: {
                        items: this.MODE_MENU
                    },
                    analogPins: {
                        items: this.ANALOG_PINS_MENU
                    },
                    level: {
                        acceptReporters: true,
                        items: this.LEVEL_MENU
                    },
                    pwmPins: {
                        items: this.PWM_PINS_MENU
                    },
                    interruptPins: {
                        items: this.INTERRUPT_PINS_MENU
                    },
                    interruptMode: {
                        items: this.INTERRUP_MODE_MENU
                    }
                }
            }
        ];
    }

    /**
     * Turn on motors for seconds.
     * @param {object} args - the block's arguments.
     * @param {object} util - utility object provided by the runtime.
     */
    motorsOnForSeconds (args, util) {
        this._motorsOnForSeconds(args.SECONDS, util);
    }

    /**
     * Turn on motors.
     */
    motorsOn () {
        this._motorsOn();
    }

    /**
     * Turn off motors.
     * @param {object} args - the block's arguments.
     */
    motorsOff () {
        this._motorsOff();
    }

    /**
     * Set robot direction.
     * @param {object} args - the block's arguments.
     */
    setDirectionTo (args) {
        this._directionLeft = args.DIRECTION;
        this._directionRight = args.DIRECTION;
    }

    /**
     * Turn robot right.
     * @param {object} args - the block's arguments.
     * @param {object} util - utility object provided by the runtime.
     */
    turnRight (args, util) {
        this._directionLeft = Direction.Backward;
        this._directionRight = Direction.Forward;
        this._motorsOnForSeconds(args.DEGREES / DEGREE_RATIO, util);
    }

    /**
     * Turn robot left.
     * @param {object} args - the block's arguments.
     * @param {object} util - utility object provided by the runtime.
     **/
    turnLeft (args, util) {
        this._directionLeft = Direction.Forward;
        this._directionRight = Direction.Backward;
        this._motorsOnForSeconds(args.DEGREES / DEGREE_RATIO, util);
    }

    /**
     * Set left and right motors power and direction.
     * @param {object} args - the block's arguments.
     */
    setPowerAndDirection (args) {
        this._directionLeft = args.DIRECTION_LEFT;
        this._directionRight = args.DIRECTION_RIGHT;
        this._powerLeft = this._convertPercentPower(args.POWER_LEFT);
        this._powerRight = this._convertPercentPower(args.POWER_RIGHT);
    }

    _motorsOnForSeconds (durationSec, util) {
        if (this._stackTimerNeedsInit(util)) {
            const duration = Math.max(0, Cast.toNumber(durationSec));
            clearTimeout(this._motorsOnForSecondsTimeout);
            this._motorsOnForSecondsTimeout = setTimeout(() => {
                this._motorsOff();
            }, duration * 1000);
            this._startStackTimer(util, duration);
            this._motorsOn();
        } else {
            this._checkStackTimer(util);
        }
    }

    _motorsOn () {
        this._peripheral.setDigitalOutput(PinsMap.LeftMotorReverse,
            this._directionLeft === Direction.Backward ? Level.High : Level.Low);
        this._peripheral.setPwmOutput(PinsMap.LeftMotorPwm, this._powerLeft);
        this._peripheral.setDigitalOutput(PinsMap.RightMotorReverse,
            this._directionRight === Direction.Backward ? Level.High : Level.Low);
        this._peripheral.setPwmOutput(PinsMap.RightMotorPwm, this._powerRight);
    }

    _motorsOff () {
        this._peripheral.setPwmOutput(PinsMap.LeftMotorPwm, MIN_MOTOR_POWER);
        this._peripheral.setPwmOutput(PinsMap.RightMotorPwm, MIN_MOTOR_POWER);
    }

    _convertPercentPower (percentPower) {
        if (percentPower < 0) {
            percentPower = 0;
        } else if (percentPower > 100) {
            percentPower = 100;
        }
        return ((percentPower * (MAX_MOTOR_POWER - MIN_MOTOR_POWER)) / 100) + MIN_MOTOR_POWER;
    }

    /**
     * Check if the stack timer needs initialization.
     * @param {object} util - utility object provided by the runtime.
     * @return {boolean} - true if the stack timer needs to be initialized.
     * @private
     */
    _stackTimerNeedsInit (util) {
        return !util.stackFrame.timer;
    }

    /**
     * Start the stack timer and the yield the thread if necessary.
     * @param {object} util - utility object provided by the runtime.
     * @param {number} duration - a duration in seconds to set the timer for.
     * @private
     */
    _startStackTimer (util, duration) {
        util.stackFrame.timer = new Timer();
        util.stackFrame.timer.start();
        util.stackFrame.duration = duration;
        util.yield();
    }

    /**
     * Check the stack timer, and if its time is not up yet, yield the thread.
     * @param {object} util - utility object provided by the runtime.
     * @private
     */
    _checkStackTimer (util) {
        const timeElapsed = util.stackFrame.timer.timeElapsed();
        if (timeElapsed < util.stackFrame.duration * 1000) {
            util.yield();
        }
    }
}

module.exports = OpenBlockRoboProBotDevice;