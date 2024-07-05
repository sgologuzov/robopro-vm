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
const MathUtil = require('../../util/math-util');
const OpenBlockArduinoUnoDevice = require('../arduinoUno/arduinoUno');
const formatMessage = require('format-message');
const log = require('../../util/log');


/**
 * The list of USB device filters.
 * @readonly
 */
const PNPID_LIST = [
    // Arduino UNO
    'USB\\VID_2341&PID_0043',
    // For chinese clones that use CH340
    'USB\\VID_1A86&PID_7523'
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
const DEVICE_OPT = {
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

const PinsMap = {
    // RoboPro
    DataLED: Pins.D2,
    Buzzer: Pins.D3,
    ClkLED: Pins.D4,
    GreenLED: Pins.D5,
    YellowLED: Pins.D6,
    RedLED: Pins.D7,
    Button1: Pins.D8,
    Button2: Pins.D9,
    Button3: Pins.D10,
    Button4: Pins.D11,
    Button5: Pins.D12,
    ExtSensor1: Pins.D13,
    TempSensor: Pins.A0,
    ExtSensor2: Pins.A1,
    Slider: Pins.A2,
    SoundSensor: Pins.A3,
    LightSensor: Pins.A4,
    LatchLED: Pins.A5
};

const MonitoringPins = ['D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', 'A3', 'A4'];

const IN_SENSOR_MIN = 0;
const IN_SENSOR_MAX = 1023;
const OUT_SENSOR_MIN = 0;
const OUT_SENSOR_MAX = 100;
const TEMP_VOLTS_PER_DEGREE = 0.02; // 0.02 for TMP37, 0.01 for TMP35/36
const TEMP_OUTPUT_VOLTAGE = 0.25; // 0.25 for TMP35, 0.75 for TMP36, 0.5 for TMP37
const TEMP_OFFSET_VALUE = TEMP_OUTPUT_VOLTAGE - (25 * TEMP_VOLTS_PER_DEGREE); // calculating the offset for 0 °C

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
        super(runtime, deviceId, originalDeviceId, PNPID_LIST, SERIAL_CONFIG, DEVICE_OPT, Pins, MonitoringPins);
    }

    /**
     * Re-maps sensor value from the 0...1023 range to the 0...100 range.
     * @param {Pins} pin - sensor pin
     * @param {number} value - value from the sensor.
     * @return {number} re-mapped value
     * @private
     */
    mapPinValue (pin, value) {
        switch (pin) {
        case PinsMap.TempSensor: {
            const volts = value * 5.0 / 1024.0;
            return Math.round((volts - TEMP_OFFSET_VALUE) / TEMP_VOLTS_PER_DEGREE);
        }
        case PinsMap.LightSensor:
            value = IN_SENSOR_MAX - value;
            break;
        }

        switch (pin) {
        case Pins.A0:
        case Pins.A1:
        case Pins.A2:
        case Pins.A3:
        case Pins.A4:
            value = ((value - IN_SENSOR_MIN) * (OUT_SENSOR_MAX - OUT_SENSOR_MIN) / (IN_SENSOR_MAX - IN_SENSOR_MIN)) +
                OUT_SENSOR_MIN;
            return Math.round(value);
        }
        return value;
    }
}

/**
 * OpenBlock blocks to interact with an Arduino Nano Ultra peripheral.
 */
class OpenBlockRoboProStationDevice extends OpenBlockArduinoUnoDevice {

    /**
     * The minimum and maximum MIDI note numbers, for clamping the input to play note.
     * @type {{min: number, max: number}}
     */
    static get MIDI_NOTE_RANGE () {
        return {min: 0, max: 130};
    }

    /**
     * The minimum and maximum beat values, for clamping the duration of play note, play drum and rest.
     * 100 beats at the default tempo of 60bpm is 100 seconds.
     * @type {{min: number, max: number}}
     */
    static get BEAT_RANGE () {
        return {min: 0, max: 100};
    }

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
                    id: 'roboPro.sensorsMenu.tempSensor',
                    default: 'temperature sensor',
                    description: 'label for temperature sensor'
                }),
                value: PinsMap.TempSensor
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
        this._peripheral.setPinMode(PinsMap.LatchLED, Mode.Output);
        this._ledState = [0, 0, 0, 0, 0, 0, 0, 0];
    }

    /**
     * @returns {Array.<object>} metadata for this extension and its blocks.
     */
    getInfo () {
        return [
            {
                id: 'roboProStation',
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
                        opcode: 'playNoteForBeats',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'roboPro.station.playNoteForBeats',
                            default: 'play note [NOTE] for [BEATS] beats',
                            description: 'play a note for a number of beats'
                        }),
                        arguments: {
                            NOTE: {
                                type: ArgumentType.NOTE,
                                defaultValue: 60
                            },
                            BEATS: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 0.25
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
                        opcode: 'readAnalogSensor',
                        text: formatMessage({
                            id: 'roboPro.station.readAnalogSensor',
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
        this._ledState[ledIndex] = 1;
        this._updateShiftRegister();
    }

    /**
     * Turn off LED.
     * @param {object} args - the block's arguments.
     */
    ledTurnOff (args) {
        const ledIndex = args.LED_INDEX;
        log.info(`[ledTurnOff] ledIndex: ${ledIndex}`);
        this._ledState[ledIndex] = 0;
        this._updateShiftRegister();
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
     * @param {BlockUtility} util - utility object provided by the runtime.
     */
    playNoteForBeats (args, util) {
        if (util.stackTimerNeedsInit()) {
            let note = Cast.toNumber(args.NOTE);
            log.info(`[playNote] note: ${note}`);
            note = MathUtil.clamp(note,
                OpenBlockRoboProStationDevice.MIDI_NOTE_RANGE.min, OpenBlockRoboProStationDevice.MIDI_NOTE_RANGE.max);
            let beats = Cast.toNumber(args.BEATS);
            beats = this._clampBeats(beats);
            // If the duration is 0, do not play the note. In Scratch 2.0, "play drum for 0 beats" plays the drum,
            // but "play note for 0 beats" is silent.
            if (beats === 0) return;

            const durationSec = this._beatsToSec(beats);
            const duration = Math.max(0, 1000 * Cast.toNumber(durationSec));
            util.startStackTimer(duration);
            this._playNote(note, duration);
            util.yield();
        } else if (!util.stackTimerFinished()) {
            util.yield();
        }
    }

    /**
     * Read sensor.
     * @param {object} args - the block's arguments.
     * @return {Promise} - a Promise that resolves when read from peripheral.
     */
    readSensor (args) {
        const promise = this._peripheral.readAnalogPin(args.PIN);
        return promise.then(value => this._peripheral.mapPinValue(args.PIN, value));
    }

    /**
     * Read button.
     * @param {object} args - the block's arguments.
     * @return {Promise} - true if read high level, false if read low level.
     */
    readButton (args) {
        this._peripheral.setPinMode(args.PIN, Mode.Input);
        return this._peripheral.readDigitalPin(args.PIN);
    }

    /**
     * Read analog pin.
     * @param {object} args - the block's arguments.
     * @return {Promise} - a Promise that resolves when read from peripheral.
     */
    readAnalogSensor (args) {
        return this._peripheral.readAnalogPin(args.PIN);
    }

    /**
     * Get the current tempo.
     * @return {number} - the current tempo, in beats per minute.
     */
    getTempo () {
        const stage = this.runtime.getTargetForStage();
        if (stage) {
            return stage.tempo;
        }
        return 60;
    }

    _updateShiftRegister () {
        this._peripheral.setPinMode(PinsMap.LatchLED, Mode.Output);
        this._peripheral.setDigitalOutput(PinsMap.LatchLED, Level.Low);
        let pinState;
        this._peripheral.setDigitalOutput(PinsMap.DataLED, Level.Low);
        this._peripheral.setDigitalOutput(PinsMap.ClkLED, Level.Low);
        for (let i = 0; i < this._ledState.length; i++) {
            this._peripheral.setDigitalOutput(PinsMap.ClkLED, Level.Low);
            if (this._ledState[i] > 0) {
                pinState = Level.High;
            } else {
                pinState = Level.Low;
            }
            this._peripheral.setDigitalOutput(PinsMap.DataLED, pinState);
            this._peripheral.setDigitalOutput(PinsMap.ClkLED, Level.High);
            this._peripheral.setDigitalOutput(PinsMap.DataLED, Level.Low);
        }
        this._peripheral.setDigitalOutput(PinsMap.ClkLED, Level.Low);
        this._peripheral.setDigitalOutput(PinsMap.LatchLED, Level.High);
    }

    /**
     * Clamp a duration in beats to the allowed min and max duration.
     * @param  {number} beats - a duration in beats.
     * @return {number} - the clamped duration.
     * @private
     */
    _clampBeats (beats) {
        return MathUtil.clamp(beats, OpenBlockRoboProStationDevice.BEAT_RANGE.min,
            OpenBlockRoboProStationDevice.BEAT_RANGE.max);
    }

    /**
     * Convert a number of beats to a number of seconds, using the current tempo.
     * @param  {number} beats - number of beats to convert to secs.
     * @return {number} seconds - number of seconds `beats` will last.
     * @private
     */
    _beatsToSec (beats) {
        return (60 / this.getTempo()) * beats;
    }

    _playNote (note, duration) {
        const frequency = Math.max(0, 440 * (2 ** ((Cast.toNumber(note) - 69) / 12)));
        clearTimeout(this._playNoteTimeout);
        this._playNoteTimeout = setTimeout(() => {
            this._peripheral.stopToneOutput(PinsMap.Buzzer);
        }, duration);
        this._peripheral.setToneOutput(PinsMap.Buzzer, frequency);
    }
}

module.exports = OpenBlockRoboProStationDevice;
