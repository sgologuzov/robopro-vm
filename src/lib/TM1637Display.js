// copied and adapted from https://github.com/thesadabc/raspberrypi-tm1637-4display and https://github.com/timwaizenegger/raspberrypi-examples/blob/master/actor-led-7segment-4numbers/tm1637.py

//
//      A
//     ---
//  F |   | B
//     -G-
//  E |   | C
//     ---
//      D
const codigitToSegmentASCII = [
    0x00, 0x86, 0x22, 0x7E, 0x6D, 0xD2, 0x46, 0x20, 0x29, 0x0B,
    0x21, 0x70, 0x10, 0x40, 0x80, 0x52, 0x3F, 0x06, 0x5B, 0x4F,
    0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x09, 0x0D, 0x61, 0x48,
    0x43, 0xD3, 0x5F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71, 0x3D,
    0x76, 0x30, 0x1E, 0x75, 0x38, 0x15, 0x37, 0x3F, 0x73, 0x6B,
    0x33, 0x6D, 0x78, 0x3E, 0x3E, 0x2A, 0x76, 0x6E, 0x5B, 0x39,
    0x64, 0x0F, 0x23, 0x08, 0x02, 0x5F, 0x7C, 0x58, 0x5E, 0x7B,
    0x71, 0x6F, 0x74, 0x10, 0x0C, 0x75, 0x30, 0x14, 0x54, 0x5C,
    0x73, 0x67, 0x50, 0x6D, 0x78, 0x1C, 0x1C, 0x14, 0x76, 0x6E,
    0x5B, 0x46, 0x30, 0x70, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00
];

const LENGTH = 4;

const DATA_CMD = 0x40;
const DISP_CMD = 0x80;
const ADDR_CMD = 0xc0;
const FIXED_ADDR = 0x04;
const PWM_MASK = 0x07;
const DISP_ON = 0x08;
const DISP_OFF = 0x00;
const DEFAULT_BRIGHTNESS = 3;

class TM1637Display {
    constructor ({clk, dio, board, brightness = DEFAULT_BRIGHTNESS}) {
        this.digits = [0x0, 0x0, 0x0, 0x0];
        this.pinClk = clk;
        this.pinDIO = dio;
        this.board = board;
        this.brightness = brightness;
        this.trueValue = 1;
        this.q = [];

        // default to HIGH
        this.board.pinMode(this.pinClk, this.board.MODES.OUTPUT);
        this.board.pinMode(this.pinDIO, this.board.MODES.OUTPUT);
        this.high(this.pinClk);
        this.high(this.pinDIO);
        this.startLoop = this.startLoop.bind(this);
        this.startLoop();
    }

    startLoop () {
        const act = this.q.shift();
        if (act) {
            if (act[0] === 'o') {
                this.board.pinMode(act[1], this.board.MODES.OUTPUT);
                this.board.digitalWrite(act[1], act[2]);
            } else if (act[0] === 'i') {
                this.board.pinMode(act[1], this.board.MODES.INPUT);
                this.board.digitalRead(act[1], act[2]);
            }
        }
        if (this.q.length) {
            setImmediate(this.startLoop);
        }
    }

    enqueue (data) {
        this.q.push(data);
        if (this.q.length === 1) {
            this.startLoop();
        }
    }

    high (pin) {
        this.enqueue(['o', pin, this.trueValue]);
    }

    low (pin) {
        this.enqueue(['o', pin, 1 - this.trueValue]);
    }

    read (pin) {
        return new Promise(resolve => this.enqueue(['i', pin, resolve]));
    }

    // clock high in, high out
    start () {
        // pinDIO  high -> low when clock is high
        this.low(this.pinDIO);
    }

    // clock high in, high out
    writeBit (value) {
        // A rising edge
        this.low(this.pinClk);
        // change the value when clock is low
        if (value) {
            this.high(this.pinDIO);
        } else {
            this.low(this.pinDIO);
        }

        this.high(this.pinClk);
    }

    readAck () {
        // Falling 8th
        this.low(this.pinClk);
        const readPro = this.read(this.pinDIO);

        // 9th rising edge
        this.high(this.pinClk);

        // Falling 9th
        this.low(this.pinClk);

        return readPro;
    }

    // clock high in, low out
    writeByte (byte) {
        console.log('[writeByte] byte:', byte);
        // 0b00000000
        let b = byte;
        for (let i = 0; i < 8; i++) {
            this.writeBit(b & 0x01);
            b >>= 1;
        }
        return this.readAck();
    }

    // clock low in, high out
    stop () {
        // pinDIO  low -> high  when clock is high
        this.low(this.pinDIO);
        this.high(this.pinClk);
        this.high(this.pinDIO);
    }

    sendCmd (cmd) {
        this.start();
        this.writeByte(cmd);
        this.stop();
    }

    sendData (addr, data) {
        this.sendCmd(DATA_CMD | FIXED_ADDR);
        this.start();
        this.writeByte(ADDR_CMD | addr);
        this.writeByte(data);
        this.stop();
    }

    setDigit (pos, str) {
        let segCode = 0x00;
        if (str !== undefined) {
            const index = str.charCodeAt(0) - 32;
            segCode = codigitToSegmentASCII[index];
        }
        this.digits[pos] = segCode;
        this.sendData(pos, segCode);
    }

    show (str) {
        this.digits = [0x00, 0x00, 0x00, 0x00];
        let nums = (`${str}`).split('');
        for (let i = 0, j = 0; i < nums.length && j < 4; i++) {
            let num = nums[i];
            if (num === '.' || num === ':') {
                // show point or colon for previous number if needed
                if (j > 0) {
                    this.digits[j - 1] |= 0b10000000;
                }
            } else {
                const index = num.charCodeAt(0) - 32;
                const segCode = codigitToSegmentASCII[index];
                this.digits[j] = segCode || 0;
                j++;
            }
        }
        this.start(); // Data command set
        this.writeByte(DATA_CMD); // Normal mode, automatic address increase, write data to the display register
        this.stop();

        this.start(); // Address command setting
        this.writeByte(ADDR_CMD); // The start of the address starts from 0
        this.digits.forEach(this.writeByte.bind(this)); // data
        this.stop();

        this.start(); // Display control
        this.writeByte(DISP_CMD | DISP_ON | (this.brightness & PWM_MASK)); // brightness
        this.stop();
    }

    setBrightness (brightness) {
        this.brightness = brightness;
        this.sendCmd(DISP_CMD | DISP_ON | (this.brightness & PWM_MASK));
    }

    on () {
        this.sendCmd(DISP_CMD | DISP_ON | (this.brightness & PWM_MASK));
    }

    off () {
        this.sendCmd(DISP_CMD | DISP_OFF);
    }

    separatorOn () {
        this.digits[1] = this.digits[1] |= 0b10000000;
        this.sendData(1, this.digits[1]);
    }

    separatorOff () {
        this.digits[1] = this.digits[1] ^= 0b10000000;
        this.sendData(1, this.digits[1]);
    }
}

module.exports = config => new TM1637Display(config);
