/**
 * Robo Bot
 *
 * @overview Compared to the Arduino Uno, this control board use CH340 as
 * use to uart chip, uese oldbootloader to flash the firmware, and there are
 * more A6 and A7 pin options.
 */

const ArduinoPeripheral = require('../common/arduino-peripheral');
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const OpenBlockArduinoUnoDevice = require('../arduinoUno/arduinoUno');
const formatMessage = require('format-message');
const log = require('../../util/log');


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

const PinsMap = {
    // RoboPro
    DataLED: Pins.D2,
    Speaker: Pins.D3,
    ClkLED: Pins.D4,
    GreenLED: Pins.D5,
    YellowLED: Pins.D6,
    RedLED: Pins.D7,
    Button1: Pins.D8,
    Button2: Pins.D9,
    Button3: Pins.D10,
    Button5: Pins.D11,
    Button4: Pins.D12,
    ExtSensor1: Pins.D13,
    ExtSensor3: Pins.A0,
    ExtSensor2: Pins.A1,
    Slider: Pins.A2,
    SoundSensor: Pins.A3,
    LightSensor: Pins.A4
};

/**
 * Manage communication with an Arduino Nano peripheral over a OpenBlock Link client socket.
 */
class RoboProStation extends ArduinoPeripheral {
    /**
     * Construct an Arduino communication object.
     * @param {Runtime} runtime - the OpenBlock runtime
     * @param {string} deviceId - the id of the extension
     * @param {string} originalDeviceId - the original id of the peripheral, like xxx_arduinoUno
     */
    constructor (runtime, deviceId, originalDeviceId) {
        super(runtime, deviceId, originalDeviceId, PNPID_LIST, SERIAL_CONFIG, DIVECE_OPT);
    }
}

/**
 * OpenBlock blocks to interact with an Arduino Nano Ultra peripheral.
 */
class OpenBlockRoboProStationDevice extends OpenBlockArduinoUnoDevice {

    /**
     * @return {string} - the ID of this extension.
     */
    get DEVICE_ID () {
        return 'roboProStation';
    }

    get BUTTONS_MENU () {
        return [
            {
                text: '1',
                value: PinsMap.Button1
            },
            {
                text: '2',
                value: PinsMap.Button2
            },
            {
                text: '3',
                value: PinsMap.Button3
            },
            {
                text: '4',
                value: PinsMap.Button4
            },
            {
                text: '5',
                value: PinsMap.Button5
            }
        ];
    }

    get COLOR_LEDS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'roboPro.colorLedsMenu.red',
                    default: 'red',
                    description: 'label for red LED'
                }),
                value: PinsMap.RedLED
            },
            {
                text: formatMessage({
                    id: 'roboPro.colorLedsMenu.yellow',
                    default: 'yellow',
                    description: 'label for yellow LED'
                }),
                value: PinsMap.YellowLED
            },
            {
                text: formatMessage({
                    id: 'roboPro.colorLedsMenu.green',
                    default: 'green',
                    description: 'label for green LED'
                }),
                value: PinsMap.GreenLED
            }
        ];
    }

    get DIGITAL_INPUT_PINS_MENU () {
        return [
            {
                text: 'D8',
                value: Pins.D8
            },
            {
                text: 'D9',
                value: Pins.D9
            },
            {
                text: 'D10',
                value: Pins.D10
            },
            {
                text: 'D11',
                value: Pins.D11
            },
            {
                text: 'D12',
                value: Pins.D12
            },
            {
                text: 'D13',
                value: Pins.D13
            }
        ];
    }

    get DIGITAL_OUTPUT_PINS_MENU () {
        return [
            {
                text: 'D2',
                value: Pins.D2
            },
            {
                text: 'D3',
                value: Pins.D3
            },
            {
                text: 'D4',
                value: Pins.D4
            },
            {
                text: 'D5',
                value: Pins.D5
            },
            {
                text: 'D6',
                value: Pins.D6
            },
            {
                text: 'D7',
                value: Pins.D7
            }
        ];
    }

    get LEDS_MENU () {
        return [
            {
                text: '0',
                value: 0
            },
            {
                text: '1',
                value: 1
            },
            {
                text: '2',
                value: 2
            },
            {
                text: '3',
                value: 3
            },
            {
                text: '4',
                value: 4
            },
            {
                text: '5',
                value: 5
            },
            {
                text: '6',
                value: 6
            },
            {
                text: '7',
                value: 7
            }
        ];
    }

    get PWM_PINS_MENU () {
        return [
            {
                text: 'D3',
                value: Pins.D3
            },
            {
                text: 'D5',
                value: Pins.D5
            },
            {
                text: 'D6',
                value: Pins.D6
            }
        ];
    }

    get SENSORS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'roboPro.sensorsMenu.lightSensor',
                    default: 'light sensor',
                    description: 'label for light sensor'
                }),
                value: PinsMap.LightSensor
            },
            {
                text: formatMessage({
                    id: 'roboPro.sensorsMenu.soundSensor',
                    default: 'sound sensor',
                    description: 'label for sound sensor'
                }),
                value: PinsMap.SoundSensor
            },
            {
                text: formatMessage({
                    id: 'roboPro.sensorsMenu.slider',
                    default: 'slider',
                    description: 'label for slider'
                }),
                value: PinsMap.Slider
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
        this._peripheral = new RoboProStation(this.runtime, this.DEVICE_ID, originalDeviceId);
    }

    /**
     * @returns {Array.<object>} metadata for this extension and its blocks.
     */
    getInfo () {
        return [
            {
                id: 'pin',
                name: formatMessage({
                    id: 'roboPro.category.roboProStation',
                    default: 'Robo Station',
                    description: 'The name of the arduino uno device pin category'
                }),
                color1: '#989898',
                color2: '#989898',
                color3: '#000000',

                blocks: [
                    {
                        opcode: 'ledTurnOn',
                        text: formatMessage({
                            id: 'roboPro.station.ledTurnOn',
                            default: 'turn LED [LED_INDEX] on',
                            description: 'Turn LED on'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            LED_INDEX: {
                                type: ArgumentType.NUMBER,
                                menu: 'leds',
                                defaultValue: 0
                            }
                        }
                    },
                    {
                        opcode: 'ledTurnOff',
                        text: formatMessage({
                            id: 'roboPro.station.ledTurnOff',
                            default: 'turn LED [LED_INDEX] off',
                            description: 'Turn LED off'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            LED_INDEX: {
                                type: ArgumentType.NUMBER,
                                menu: 'leds',
                                defaultValue: 0
                            }
                        }
                    },
                    {
                        opcode: 'colorLedTurnOn',
                        text: formatMessage({
                            id: 'roboPro.station.colorLedTurnOn',
                            default: 'turn LED [LED_PIN] on',
                            description: 'Turn LED on'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            LED_PIN: {
                                type: ArgumentType.STRING,
                                menu: 'colorLeds',
                                defaultValue: PinsMap.RedLED
                            }
                        }
                    },
                    {
                        opcode: 'colorLedTurnOff',
                        text: formatMessage({
                            id: 'roboPro.station.colorLedTurnOff',
                            default: 'turn LED [LED_PIN] off',
                            description: 'Turn LED on'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            LED_PIN: {
                                type: ArgumentType.STRING,
                                menu: 'colorLeds',
                                defaultValue: PinsMap.RedLED
                            }
                        }
                    },
                    {
                        opcode: 'colorLedTurnOff',
                        text: formatMessage({
                            id: 'roboPro.station.colorLedTurnOff',
                            default: 'turn LED [LED_PIN] on',
                            description: 'Turn LED on'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            LED_PIN: {
                                type: ArgumentType.STRING,
                                menu: 'colorLeds',
                                defaultValue: PinsMap.RedLED
                            }
                        }
                    },
                    {
                        opcode: 'playNote',
                        text: formatMessage({
                            id: 'roboPro.station.playNote',
                            default: 'play note [NOTE]',
                            description: 'play a note'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            NOTE: {
                                type: ArgumentType.NOTE,
                                defaultValue: 48
                            }
                        }
                    },
                    {
                        opcode: 'readSensor',
                        text: formatMessage({
                            id: 'roboPro.station.readSensor',
                            default: 'read [PIN]',
                            description: 'play a note'
                        }),
                        blockType: BlockType.REPORTER,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'sensors',
                                defaultValue: PinsMap.LightSensor
                            }
                        }
                    },
                    {
                        opcode: 'readButton',
                        text: formatMessage({
                            id: 'roboPro.station.readButton',
                            default: 'button [PIN] pressed',
                            description: 'roboProStation read button'
                        }),
                        blockType: BlockType.BOOLEAN,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'buttons',
                                defaultValue: PinsMap.Button1
                            }
                        }
                    },
                    {
                        opcode: 'readAnalogPin',
                        text: formatMessage({
                            id: 'roboPro.station.readAnalogPin',
                            default: 'read pin [PIN]',
                            description: 'roboProStation read analog pin'
                        }),
                        blockType: BlockType.REPORTER,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'analogPins',
                                defaultValue: Pins.A0
                            }
                        }
                    },
                    {
                        opcode: 'readDigitalPin',
                        text: formatMessage({
                            id: 'roboPro.station.readDigitalPin',
                            default: 'read pin [PIN]',
                            description: 'roboProStation read digital pin'
                        }),
                        blockType: BlockType.BOOLEAN,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'digitalInputPins',
                                defaultValue: Pins.D8
                            }
                        }
                    },
                    {
                        opcode: 'setDigitalOutput',
                        text: formatMessage({
                            id: 'roboPro.station.setDigitalOutput',
                            default: 'set pin [PIN] out [LEVEL]',
                            description: 'roboProStation set digital pin out'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'digitalOutputPins',
                                defaultValue: Pins.D0
                            },
                            LEVEL: {
                                type: ArgumentType.STRING,
                                menu: 'level',
                                defaultValue: Level.High
                            }
                        }
                    },
                    {
                        opcode: 'setPwmOutput',
                        text: formatMessage({
                            id: 'roboPro.station.setPwmOutput',
                            default: 'set pwm pin [PIN] out [OUT]',
                            description: 'roboProStation set pwm pin out'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'pwmPins',
                                defaultValue: Pins.D3
                            },
                            OUT: {
                                type: ArgumentType.UINT8_NUMBER,
                                defaultValue: '255'
                            }
                        }
                    }
                ],
                menus: {
                    analogPins: {
                        items: this.ANALOG_PINS_MENU
                    },
                    buttons: {
                        items: this.BUTTONS_MENU
                    },
                    colorLeds: {
                        items: this.COLOR_LEDS_MENU
                    },
                    digitalInputPins: {
                        items: this.DIGITAL_INPUT_PINS_MENU
                    },
                    digitalOutputPins: {
                        items: this.DIGITAL_OUTPUT_PINS_MENU
                    },
                    leds: {
                        items: this.LEDS_MENU
                    },
                    level: {
                        acceptReporters: true,
                        items: this.LEVEL_MENU
                    },
                    pwmPins: {
                        items: this.PWM_PINS_MENU
                    },
                    sensors: {
                        items: this.SENSORS_MENU
                    }
                }
            }
        ];
    }

    /**
     * Turn on LED.
     * @param {object} args - the block's arguments.
     */
    ledTurnOn (args) {
        const ledIndex = args.LED_INDEX;
        log.info(`[ledTurnOn] ledIndex: ${ledIndex}`);
    }

    /**
     * Turn off LED.
     * @param {object} args - the block's arguments.
     */
    ledTurnOff (args) {
        const ledIndex = args.LED_INDEX;
        log.info(`[ledTurnOff] ledIndex: ${ledIndex}`);
    }

    /**
     * Turn on color LED.
     * @param {object} args - the block's arguments.
     */
    colorLedTurnOn (args) {
        const ledPin = args.LED_PIN;
        log.info(`[colorLedTurnOn] ledPin: ${ledPin}`);
        this._peripheral.setDigitalOutput(ledPin, Level.High);
    }

    /**
     * Turn off color LED.
     * @param {object} args - the block's arguments.
     */
    colorLedTurnOff (args) {
        const ledPin = args.LED_PIN;
        log.info(`[colorLedTurnOff] ledPin: ${ledPin}`);
        this._peripheral.setDigitalOutput(ledPin, Level.Low);
    }

    /**
     * Play a note.
     * @param {object} args - the block's arguments.
     */
    playNote (args) {
        const note = Cast.toNumber(args.NOTE);
        log.info(`[playNote] note: ${note}`);
    }

    /**
     * Read sensor.
     * @param {object} args - the block's arguments.
     * @return {number} - analog value fo the pin.
     */
    readSensor (args) {
        return this._peripheral.readAnalogPin(args.PIN);
    }

    /**
     * Read button.
     * @param {object} args - the block's arguments.
     * @return {boolean} - true if read high level, false if read low level.
     */
    readButton (args) {
        return this._peripheral.readDigitalPin(args.PIN);
    }
}

module.exports = OpenBlockRoboProStationDevice;
