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

/**
 * Manage communication with a Arduino Nano peripheral over a OpenBlock Link client socket.
 */
class RoboProStation extends ArduinoPeripheral{
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
class OpenBlockRoboProStationDevice extends OpenBlockArduinoUnoDevice{

    /**
      * @return {string} - the ID of this extension.
      */
    get DEVICE_ID () {
        return 'roboProStation';
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
                color1: '#4C97FF',
                color2: '#3373CC',
                color3: '#3373CC',

                blocks: []
            }
        ];
    }
}

module.exports = OpenBlockRoboProStationDevice;
