const formatMessage = require('format-message');
const Buffer = require('buffer').Buffer;
const Color = require('../../util/color');

const Serialport = require('../../io/serialport');
const Base64Util = require('../../util/base64-util');

const Emitter = require('events');
const Firmata = require('../../lib/firmata/firmata');
const {Map} = require('immutable');
const pixel = require('../../lib/node-pixel');
const tm1637 = require('../../lib/TM1637Display');
const VL53L0X = require('../../lib/VL53L0X');

const LED_STRIP_LENGTH = 16;
const LED_STRIP_BLACK_COLOR = '#000';

const VL53L0X_ADRESS = '0x29';

/**
 * A string to report connect firmata timeout.
 * @type {formatMessage}
 */
const ConnectFirmataTimeout = formatMessage({
    id: 'arduinoPeripheral.connection.connectFirmataTimeout',
    default: 'Timeout when try to connect firmata, please download the firmware first',
    description: 'label for connect firmata timeout'
});

/**
 * A time interval to send firmata heartbeat(in milliseconds).
 */
const FrimataHeartbeatInterval = 1000;

/**
 * A time interval to wait (in milliseconds) before reporting to the serialport socket
 * that heartbeat has stopped coming from the peripheral.
 */
const FrimataHeartbeatTimeout = 2200;

/**
 * A time interval wait (in milliseconds) before reporting to the serialport socket
 * that firmata still hasn't received the ready event.
 */
const FirmataReadyTimeout = 6500;

/**
 * A time interval to wait device reports data.
 */
const FrimataReadTimeout = 2000;

/**
 * A time interval to wait device accepts data.
 */
const FrimataWriteTimeout = 20;

const Level = {
    High: 'HIGH',
    Low: 'LOW'
};

const Mode = {
    Input: 'INPUT',
    Output: 'OUTPUT',
    InputPullup: 'INPUT_PULLUP',
    I2C: 'I2C',
    OneWire: 'ONEWIRE'
};

/**
 * Manage communication with a Arduino peripheral over a OpenBlock Link client socket.
 */
class ArduinoPeripheral extends Emitter {

    /**
     * Construct an Arduino communication object.
     * @param {Runtime} runtime - the OpenBlock runtime
     * @param {string} deviceId - the id of the peripheral
     * @param {string} originalDeviceId - the original id of the peripheral, like xxx_arduinoUno
     * @param {object} pnpidList - the pnp id of the peripheral
     * @param {object} serialConfig - the serial config of the peripheral
     * @param {object} deviceOpt - the device option of the peripheral
     * @param {object} pins - the device pins of the peripheral
     * @param {array} monitoringPins - array of pins for monitoring
     */
    constructor (runtime, deviceId, originalDeviceId, pnpidList, serialConfig, deviceOpt, pins, monitoringPins) {
        super();
        /**
         * The OpenBlock runtime used to trigger the green flag button.
         * @type {Runtime}
         * @private
         */
        this._runtime = runtime;

        this.pnpidList = pnpidList;
        this.serialConfig = serialConfig;
        this.deviceOpt = deviceOpt;
        this.pins = pins;
        this.monitoringPins = monitoringPins;

        /**
         * The serialport connection socket for reading/writing peripheral data.
         * @type {SERIALPORT}
         * @private
         */
        this._serialport = null;
        this._runtime.registerPeripheralExtension(deviceId, this);
        this._runtime.setRealtimeBaudrate(this.serialConfig.baudRate);

        /**
         * The id of the peripheral this peripheral belongs to.
         */
        this._deviceId = deviceId;

        this._originalDeviceId = originalDeviceId;

        /**
        * Pending data list. If busy is set when send, the data will push into this array to
        * waitting to be sended.
        */
        this._pendingData = [];

        this.disableMonitoring = this.disableMonitoring.bind(this);
        this.enableMonitoring = this.enableMonitoring.bind(this);
        this.reset = this.reset.bind(this);
        this._onConnect = this._onConnect.bind(this);
        this._onMessage = this._onMessage.bind(this);
        this._onPinMonitoring = this._throttle(this._onPinMonitoring.bind(this), 250);

        /**
         * Firmata connection.
         * @type {?Firmata}
         * @private
         */
        this._firmata = null;

        /**
         * Timeout ID for firmata get heartbeat timeout.
         * @type {number}
         * @private
         */
        this._firmataTimeoutID = null;

        /**
         * Timeout ID for firmata get ready event timeout.
         * @type {number}
         * @private
         */
        this._firmataReadyTimeoutID = null;

        /**
         * Interval ID for firmata send heartbeat.
         * @type {number}
         * @private
         */
        this._firmataIntervelID = null;

        /**
         * A flag that is true while firmata is conncted.
         * @type {boolean}
         * @private
         */
        this._isFirmataConnected = false;

        this._monitorData = null;
        this._startHeartbeat = this._startHeartbeat.bind(this);
        this._listenHeartbeat = this._listenHeartbeat.bind(this);
        this._handleProgramModeUpdate = this._handleProgramModeUpdate.bind(this);
        /**
         * 1-wire devices
         * @type {?Map}
         * @private
         */
        this._oneWireDevices = Map();
    }

    initDistanceSensor (address) {
        this.distanceSensor = VL53L0X({
            board: this._firmata,
            address: Number(address)
        });
    }

    initDisplay (clkLed, dataLed) {
        this.display = tm1637({
            clk: clkLed,
            dio: dataLed,
            board: this._firmata
        });
    }

    initLedStrip (pin) {
        this.strip = new pixel.Strip({
            data: pin,
            length: LED_STRIP_LENGTH,
            firmata: this._firmata,
            skip_firmware_check: true
        });
    }

    /**
     * Called by the runtime when user wants to upload code to a peripheral.
     * @param {string} code - the code want to upload.
     */
    upload (code) {
        // Delete curent firmata. Otherwise, after uploading a new program in upload mode,
        // when returning to real time mode, since the old fimata service still exists,
        // an RealtimeDisconnectErrorerror will be reported quickly.
        if (this._firmata) {
            this._firmata.removeAllListeners('reportversion');
            this._firmata.removeAllListeners('ready');
            delete this._firmata;
        }

        const base64Str = Buffer.from(code).toString('base64');
        this._serialport.upload(base64Str, this.deviceOpt, 'base64');
    }

    /**
     * Called by the runtime when user wants to upload realtime firmware to a peripheral.
     */
    uploadFirmware () {
        if (this._firmata) {
            this._firmata.removeAllListeners('reportversion');
            this._firmata.removeAllListeners('ready');
            delete this._firmata;
        }
        if (this._firmataReadyTimeoutID) {
            window.clearTimeout(this._firmataReadyTimeoutID);
            this._firmataReadyTimeoutID = null;
        }
        this._stopHeartbeat();
        this._serialport.uploadFirmware(this.deviceOpt);
    }

    /**
     * Called by the runtime when user wants to abort the uploading process.
     */
    abortUpload () {
        this._serialport.abortUpload();
    }

    /**
     * Called by the runtime when user wants to scan for a peripheral.
     * @param {Array.<string>} pnpidList - the array of pnp id list
     * @param {bool} listAll - wether list all connectable device
     */
    scan (pnpidList, listAll) {
        if (this._serialport) {
            this._serialport.disconnect();
        }
        this._serialport = new Serialport(this._runtime, this._originalDeviceId, {
            filters: {
                pnpid: listAll ? ['*'] : (pnpidList ? pnpidList : this.pnpidList)
            }
        }, this._onConnect, this.reset);
    }

    /**
     * Called by the runtime when user wants to connect to a certain peripheral.
     * @param {number} id - the id of the peripheral to connect to.
     * @param {?number} baudrate - the baudrate.
     */
    connect (id, baudrate = null) {
        const config = Object.assign({}, this.serialConfig);
        if (baudrate) {
            config.baudRate = baudrate;
        }
        if (this._serialport) {
            this._serialport.connectPeripheral(id, {config: config});
        }
    }

    /**
     * Disconnect from the peripheral.
     */
    disconnect () {
        if (this._serialport) {
            this._serialport.disconnect();
        }

        this.reset();
    }

    /**
     * Reset all the state and timeout/interval ids.
     */
    reset () {
        if (this._firmata) {
            this._firmata.removeAllListeners('reportversion');
            this._firmata.removeAllListeners('ready');
            delete this._firmata;
        }
        if (this._firmataReadyTimeoutID) {
            window.clearTimeout(this._firmataReadyTimeoutID);
            this._firmataReadyTimeoutID = null;
        }
        this._stopHeartbeat();
        this._runtime.removeListener(this._runtime.constructor.PROGRAM_MODE_UPDATE, this._handleProgramModeUpdate);
        this._runtime.removeListener(this._runtime.constructor.PERIPHERAL_UPLOAD_SUCCESS, this._startHeartbeat);
    }

    /**
     * Return true if connected to the peripheral.
     * @return {boolean} - whether the peripheral is connected.
     */
    isConnected () {
        let connected = false;
        if (this._serialport) {
            connected = this._serialport.isConnected();
        }
        return connected;
    }

    /**
     * Set baudrate of the peripheral serialport.
     * @param {number} baudrate - the baudrate.
     */
    setBaudrate (baudrate) {
        this._serialport.setBaudrate(baudrate);
    }

    /**
     * Write data to the peripheral serialport.
     * @param {string} data - the data to write.
     */
    write (data) {
        if (!this.isConnected()) return;

        const base64Str = Buffer.from(data).toString('base64');
        this._serialport.write(base64Str, 'base64');
    }

    /**
     * Send a message to the peripheral Serialport socket.
     * @param {Uint8Array} message - the message to write
     */
    send (message) {
        if (!this.isConnected()) return;

        const data = Base64Util.uint8ArrayToBase64(message);
        this._serialport.write(data, 'base64');
    }

    /**
     * Re-maps pin value if need.
     * @param {Pins} pin - sensor pin
     * @param {number} value - value from the sensor.
     * @return {number} re-mapped value
     * @private
     */
    mapPinValue (pin, value) {
        return value;
    }

    /**
     * Start send/recive heartbeat timer.
     * @private
     */
    _startHeartbeat () {
        if (this._runtime.isRealtimeMode()) {
            // eslint-disable-next-line no-negated-condition
            if (!this._firmata) {
                // Start a timeout to report that firmata did not receive the ready event.
                // This happens after connecting to a device that is not running the firmata service.
                this._firmataReadyTimeoutID = window.setTimeout(() => {
                    this._serialport.handleRealtimeDisconnectError(ConnectFirmataTimeout);
                }, FirmataReadyTimeout);

                this._firmata = new Firmata(this.send.bind(this));
                this._firmata.once('ready', () => {
                    if (this._firmataReadyTimeoutID) {
                        window.clearTimeout(this._firmataReadyTimeoutID);
                        this._firmataReadyTimeoutID = null;
                    }

                    // Receiving a ready event indicates that the firmata service has been initialized.
                    this._isFirmataConnected = true;
                    this._serialport.handleRealtimeConnectSucess();

                    // Start the heartbeat listener.
                    this._firmata.on('reportversion', this._listenHeartbeat);

                    this._firmataIntervelID = window.setInterval(() => {
                        // Send reportVersion request as heartbeat.
                        this._firmata.reportVersion(() => { });
                    }, FrimataHeartbeatInterval);

                    // Start a timer if heartbeat timeout means failed to connect firmata.
                    this._firmataTimeoutID = window.setTimeout(() => {
                        this._isFirmataConnected = false;
                        this._serialport.handleRealtimeDisconnectError(ConnectFirmataTimeout);
                    }, FrimataHeartbeatTimeout);
                    this.emit('connected');
                });
            } else {
                this._stopHeartbeat();

                this._firmataIntervelID = window.setInterval(() => {
                    // Send reportVersion request as heartbeat.
                    this._firmata.reportVersion(() => { });
                }, FrimataHeartbeatInterval);

                // Start a timer if heartbeat timeout means failed to connect firmata.
                this._firmataTimeoutID = window.setTimeout(() => {
                    this._isFirmataConnected = false;
                    this._serialport.handleRealtimeDisconnectError(ConnectFirmataTimeout);
                }, FrimataHeartbeatTimeout);
            }
        }
    }

    /**
     * Stop send/recive heartbeat timer.
     * @private
     */
    _stopHeartbeat () {
        if (this._firmataTimeoutID) {
            window.clearTimeout(this._firmataTimeoutID);
            this._firmataTimeoutID = null;
        }
        if (this._firmataIntervelID) {
            window.clearInterval(this._firmataIntervelID);
            this._firmataIntervelID = null;
        }
        this._isFirmataConnected = false;
        this.emit('disconnected');
    }

    /**
     * Listen the heartbeat and emit connection state event.
     * @private
     */
    _listenHeartbeat () {
        if (!this._isFirmataConnected) {
            this._isFirmataConnected = true;
            this._serialport.handleRealtimeConnectSucess();
        }
        // Reset the timeout timer
        window.clearTimeout(this._firmataTimeoutID);
        this._firmataTimeoutID = window.setTimeout(() => {
            this._isFirmataConnected = false;
            this._serialport.handleRealtimeDisconnectError(ConnectFirmataTimeout);
        }, FrimataHeartbeatTimeout);
    }

    /**
     * Handle the program mode update event. If in realtime mode start the heartbeat else stop.
     */
    _handleProgramModeUpdate () {
        if (this._runtime.isRealtimeMode()) {
            this._startHeartbeat();
        } else {
            // If _firmataReadyTimeoutID is still not null when switching to upload mode, it means
            // that the Firmata protocol has not completed the initial communication, reset the
            // firmata and wait for the next connection.
            if (this._firmataReadyTimeoutID) {
                if (this._firmata) {
                    this._firmata.removeAllListeners('reportversion');
                    this._firmata.removeAllListeners('ready');
                    delete this._firmata;
                }
                if (this._firmataReadyTimeoutID) {
                    window.clearTimeout(this._firmataReadyTimeoutID);
                    this._firmataReadyTimeoutID = null;
                }
            }
            this._stopHeartbeat();
        }
    }

    /**
     * Starts reading data from peripheral after serialport has connected to it.
     * @private
     */
    _onConnect () {
        this._serialport.read(this._onMessage);

        this._startHeartbeat();

        this._runtime.on(this._runtime.constructor.PROGRAM_MODE_UPDATE, this._handleProgramModeUpdate);
        this._runtime.on(this._runtime.constructor.PERIPHERAL_UPLOAD_SUCCESS, this._startHeartbeat);
    }

    /**
     * Process the sensor data from the incoming serialport characteristic.
     * @param {object} base64 - the incoming serialport data.
     * @private
     */
    _onMessage (base64) {
        if (this._runtime.isRealtimeMode()) {
            const data = Base64Util.base64ToUint8Array(base64);
            this._firmata.onReciveData(data);
        } else {
            const consoleData = Buffer.from(base64, 'base64');
            this._runtime.emit(this._runtime.constructor.PERIPHERAL_RECIVE_DATA, consoleData);
        }
    }

    /**
     * Return true if peripheral has connected to firmata and program mode is realtime.
     * @return {boolean} - whether the peripheral is ready for realtime mode communication.
     */
    isReady () {
        if (this._runtime.isRealtimeMode() && this._isFirmataConnected) {
            return true;
        }
        return false;
    }

    /**
     * @param {PIN} pin - the pin string to parse.
     * @return {number} - the pin number.
     */
    parsePin (pin) {
        if (pin.charAt(0) === 'A') {
            return parseInt(pin.slice(1), 10) + 14;
        }
        return parseInt(pin, 10);
    }

    /**
     * @param {LEVEL} level - the level string to parse.
     * @return {number} - the level in number.
     */
    parseLevel (level) {
        if (level === Level.High) {
            return 1;
        }
        return 0;
    }

    /**
     * @param {PIN} pin - the pin to set.
     * @param {MODE} mode - the pin mode to set.
     * @return {Promise} - a Promise that resolves on fixed write timeout to peripheral.
     */
    setPinMode (pin, mode) {
        if (this.isReady()) {
            return new Promise(resolve => {
                pin = this.parsePin(pin);
                switch (mode) {
                case Mode.Input:
                    mode = this._firmata.MODES.INPUT;
                    break;
                case Mode.Output:
                    mode = this._firmata.MODES.OUTPUT;
                    break;
                case Mode.InputPullup:
                    mode = this._firmata.MODES.PULLUP;
                    break;
                case Mode.I2C:
                    mode = this._firmata.MODES.I2C;
                    break;
                case Mode.OneWire:
                    mode = this._firmata.MODES.ONEWIRE;
                    break;
                }
                this._firmata.pinMode(pin, mode);

                // Инициализация пинов
                switch (mode) {
                case this._firmata.MODES.ONEWIRE:
                    this._initOneWirePin(pin);
                    break;
                }
                window.setTimeout(() => {
                    resolve();
                }, FrimataWriteTimeout);
            });
        }
    }

    /**
     * @param {PIN} pin - the pin to set.
     * @param {LEVEL} level - the pin level to set.
     * @return {Promise} - a Promise that resolves on fixed write timeout to peripheral.
     */
    setDigitalOutput (pin, level) {
        if (this.isReady()) {
            return new Promise(resolve => {
                pin = this.parsePin(pin);
                level = this.parseLevel(level);
                this._firmata.digitalWrite(pin, level);
                window.setTimeout(() => {
                    resolve();
                }, FrimataWriteTimeout);
            });
        }
    }

    /**
     * @param {PIN} pin - the pin to set.
     * @param {VALUE} value - the pwm value to set.
     * @return {Promise} - a Promise that resolves on fixed write timeout to peripheral.
     */
    setPwmOutput (pin, value) {
        if (this.isReady()) {
            return new Promise(resolve => {
                pin = this.parsePin(pin);
                if (value < 0) {
                    value = 0;
                }
                if (value > 255) {
                    value = 255;
                }
                this._firmata.pinMode(pin, this._firmata.MODES.PWM);
                this._firmata.pwmWrite(pin, value);
                window.setTimeout(() => {
                    resolve();
                }, FrimataWriteTimeout);
            });
        }
    }

    /**
     * @param {PIN} pin - the pin to read.
     * @return {Promise} - a Promise that resolves when read from peripheral.
     */
    readDigitalPin (pin) {
        if (this.isReady()) {
            pin = this.parsePin(pin);
            return new Promise(resolve => {
                this._firmata.digitalRead(pin, value => {
                    resolve(value);
                });
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    /**
     * @param {PIN} pin - the pin to read.
     * @return {Promise} - a Promise that resolves when read from peripheral.
     */
    readAnalogPin (pin) {
        if (this.isReady()) {
            pin = this.parsePin(pin);
            // Shifting to analog pin number.
            pin = pin - 14;
            this._firmata.pinMode(pin, this._firmata.MODES.ANALOG);
            return new Promise(resolve => {
                this._firmata.analogRead(pin, value => {
                    resolve(value);
                });
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    readDS18B20 (pin, deviceIndex) {
        if (this.isReady()) {
            pin = this.parsePin(pin);
            const devices = this._oneWireDevices.get(pin).filter(item => item[0] === 0x28);
            const device = devices[deviceIndex];
            // TODO: устройство не найдено
            this._firmata.sendOneWireReset(pin); // Reset
            this._firmata.sendOneWireWrite(pin, device, 0x44); // Select device, process temp
            this._firmata.sendOneWireDelay(pin, 1000); // Delay - prevents premature reading
            this._firmata.sendOneWireReset(pin); // Reset

            return new Promise(resolve => {
                this._firmata.sendOneWireWriteAndRead(pin, device, 0xBE, 9, (err, data) => {
                    if (err) {
                        resolve(err);
                    }

                    const temp = ((data[1] << 8) | data[0]) / 16.0;
                    resolve(temp.toFixed(1));
                });
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    readDistance (address) {
        if (this.isReady()) {
            return new Promise(resolve => {
                this.distanceSensor.getDistance(Number(address), data => {
                    resolve(data.distance);
                });
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    /**
     * @param {PIN} pin - the pin to set.
     * @param {VALUE} value - the degree to set.
     * @return {Promise} - a Promise that resolves on fixed write timeout to peripheral.
     */
    setServoOutput (pin, value) {
        if (this.isReady()) {
            return new Promise(resolve => {
                pin = this.parsePin(pin);
                if (value < 0) {
                    value = 0;
                }
                if (value > 180) {
                    value = 180;
                }
                this._firmata.pinMode(pin, this._firmata.MODES.PWM);
                this._firmata.pwmWrite(pin, value);

                this._firmata.servoConfig(pin, 600, 2400);
                this._firmata.servoWrite(pin, value);
                window.setTimeout(() => {
                    resolve();
                }, FrimataWriteTimeout);
            });
        }
    }

    /**
     * @param {PIN} pin - the pin to set.
     * @param {number} frequency - tone frequency to set.
     */
    setToneOutput (pin, frequency) {
        if (this.isReady()) {
            pin = this.parsePin(pin);
            this._firmata.buzzerTone(pin, frequency);
        }
    }

    /**
     * @param {PIN} pin - the pin to set.
     * @param {LEVEL} level - the pin level to set.
     */
    stopToneOutput (pin) {
        if (this.isReady()) {
            pin = this.parsePin(pin);
            this._firmata.buzzerNoTone(pin);
        }
    }

    setIndicatorBrightness (value) {
        if (this.display && this.isReady()) {
            return new Promise(resolve => {
                this.display.setBrightness(value);
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    setIndicatorDigitValue (digit, value) {
        if (this.display && this.isReady()) {
            return new Promise(resolve => {
                this.display.setDigit(digit, value);
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    setIndicatorValue (value) {
        if (this.display && this.isReady()) {
            return new Promise(resolve => {
                this.display.show(value);
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    turnIndicatorSeparator (value) {
        if (this.display && this.isReady()) {
            return new Promise(resolve => {
                if (value === 'on') {
                    this.display.separatorOn();
                } else {
                    this.display.separatorOff();
                }
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    turnIndicator (value) {
        if (this.display && this.isReady()) {
            return new Promise(resolve => {
                if (value === 'on') {
                    this.display.on();
                } else {
                    this.display.off();
                }
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    ledStripTurn (color, value) {
        if (this.strip && this.isReady()) {
            return new Promise(resolve => {
                if (Number.isInteger(color)) {
                    color = Color.decimalToHex(color);
                }
                if (value === 'off') {
                    this.strip.off();
                } else {
                    this.strip.color(color);
                    this.strip.show();
                }
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    ledStripPixelTurn (ledIndex, color, value) {
        if (this.strip && this.isReady()) {
            return new Promise(resolve => {
                if (Number.isInteger(color)) {
                    color = Color.decimalToHex(color);
                }
                if (value === 'off') {
                    color = LED_STRIP_BLACK_COLOR;
                }
                const stripPixel = this.strip.pixel(ledIndex);
                if (stripPixel) {
                    stripPixel.color(color);
                }
                this.strip.show();
                window.setTimeout(() => {
                    resolve();
                }, FrimataReadTimeout);
            });
        }
    }

    enableMonitoring () {
        this._monitorData = {};
        if (this.monitoringPins) {
            for (const item of this.monitoringPins) {
                const key = item.key;
                switch (key) {
                case VL53L0X_ADRESS:
                    if (this.distanceSensor) {
                        this.distanceSensor.getDistance(Number(VL53L0X_ADRESS), data => {
                            this._onPinMonitoring({pin: key, value: data.distance});
                        }, false);
                    }
                    break;
                default:
                    const pin = this.pins[key];
                    let pinIndex = this.parsePin(pin);
                    if (pin.startsWith('A')) {
                        // Shifting to analog pin number.
                        pinIndex = pinIndex - 14;
                        this._firmata.reportAnalogPin(pinIndex, 1);
                    } else {
                        this._firmata.reportDigitalPin(pinIndex, 1);
                    }
                    break;
                }
                this._monitorData[key] = {
                    value: 0,
                    description: formatMessage({
                        id: item.messageId,
                        default: key,
                        description: `label for ${key} pin`
                    })
                };
            }
        }
        this._firmata.on('pin-monitoring', this._onPinMonitoring);
        return this._monitorData;
    }

    disableMonitoring () {
        this._monitorData = null;
        if (this.monitoringPins) {
            for (const item of this.monitoringPins) {
                const key = item.key;
                switch (key) {
                case VL53L0X_ADRESS:
                    this._firmata.i2cStop({address: Number(key)});
                    break;
                default:
                    const pin = this.pins[key];
                    let pinIndex = this.parsePin(pin);
                    if (pin.startsWith('A')) {
                        // Shifting to analog pin number.
                        pinIndex = pinIndex - 14;
                        this._firmata.reportAnalogPin(pinIndex, 0);
                    } else {
                        this._firmata.reportDigitalPin(pinIndex, 0);
                    }
                    break;
                }
            }
        }
        this._firmata.removeAllListeners('pin-monitoring');
    }

    _onPinMonitoring (data) {
        if (this._monitorData) {
            let pin = data.pin;
            switch (pin) {
            case VL53L0X_ADRESS:
                break;
            default:
                pin = Object.keys(this.pins)[data.pin];
                break;
            }
            if (this.monitoringPins && this.monitoringPins.find(item => item.key === pin)) {
                const pinName = this.pins[pin];
                this._monitorData[pin].value = this.mapPinValue(pinName || pin, data.value);
                this._runtime.requestUpdateMonitor(Map({
                    id: this._deviceId,
                    value: {...this._monitorData}
                }));
            }
        }
    }

    /**
     * @param {PIN} pin - the pin to init.
     * @return {Promise} - a Promise that resolves when read from peripheral.
     */
    _initOneWirePin (pin) {
        console.log(`[_initOneWirePin] pin: ${pin}`);
        if (this.isReady()) {
            this._firmata.sendOneWireConfig(pin, false);
            return new Promise(resolve => {
                this._firmata.sendOneWireSearch(pin, (err, devices) => {
                    console.log('[_initOneWirePin] err:', err);
                    console.log('[_initOneWirePin] devices:', devices);
                    if (err) {
                        resolve(err);
                        return;
                    }
                    const len = devices.length;
                    let i = 0;
                    console.log('----------------------');
                    console.log('1-Wire Addresses:');
                    for (i = 0; i < len; i++) {
                        console.log(devices[i]);
                        this._oneWireDevices = this._oneWireDevices.set(pin, devices);
                    }
                    console.log('----------------------');
                    resolve();
                    window.setTimeout(() => {
                        resolve();
                    }, FrimataReadTimeout);
                });
            });
        }
    }

    _throttle (mainFunction, delay) {
        let timerFlag = null; // Variable to keep track of the timer
        // Returning a throttled version
        return (...args) => {
            if (timerFlag === null) { // If there is no timer currently running
                mainFunction(...args); // Execute the main function
                timerFlag = setTimeout(() => { // Set a timer to clear the timerFlag after the specified delay
                    timerFlag = null; // Clear the timerFlag to allow the main function to be executed again
                }, delay);
            }
        };
    }
}

module.exports = ArduinoPeripheral;
