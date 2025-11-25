const VL53L0X_DEF_I2C_ADDR = 0x29;
const VL53L0X_REG_IDENTIFICATION_MODEL_ID = 0x00c0;
const VL53L0X_REG_IDENTIFICATION_REVISION_ID = 0x00c2;
const VL53L0X_REG_PRE_RANGE_CONFIG_VCSEL_PERIOD = 0x0050;
const VL53L0X_REG_FINAL_RANGE_CONFIG_VCSEL_PERIOD = 0x0070;
const VL53L0X_REG_SYSRANGE_START = 0x0000;
const VL53L0X_REG_RESULT_INTERRUPT_STATUS = 0x0013;
const VL53L0X_REG_RESULT_RANGE_STATUS = 0x0014;
const VL53L0X_REG_I2C_SLAVE_DEVICE_ADDRESS = 0x008a;
const VL53L0X_REG_SYSTEM_RANGE_CONFIG = 0x0009;
const VL53L0X_REG_VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV = 0x0089;
const VL53L0X_REG_SYSRANGE_MODE_SINGLESHOT = 0x0000;
const VL53L0X_REG_SYSRANGE_MODE_START_STOP = 0x0001;
const VL53L0X_REG_SYSRANGE_MODE_BACKTOBACK = 0x0002;
const VL53L0X_REG_SYSRANGE_MODE_TIMED = 0x0004;

class VL53L0X {

    constructor ({board, address = VL53L0X_DEF_I2C_ADDR}) {
        this.board = board;
        this.init(address);
    }

    init (address) {
        console.log('VL53L0X.init. address:', address);
        this.readByteData(address, VL53L0X_REG_VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV)
            .then(data => {
                console.log('VL53L0X.init. data:', data);
                data = (data & 0xFE) | 0x01;
                this.writeByteData(address, VL53L0X_REG_VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV, data);
            });
        this.readByteData(address, VL53L0X_REG_IDENTIFICATION_REVISION_ID)
            .then(data => console.log('[VL53L0X] Revision ID: ', data.toString(16).toUpperCase()));
        this.readByteData(address, VL53L0X_REG_IDENTIFICATION_MODEL_ID)
            .then(data => console.log('[VL53L0X] Device ID: ', data.toString(16).toUpperCase()));
        // Back-to-back mode
        this.writeByteData(address, VL53L0X_REG_SYSRANGE_START, VL53L0X_REG_SYSRANGE_MODE_BACKTOBACK);
    }

    /**
     * Получение расстояния
     */
    getDistance (address, callback, once = true) {
        this.readData(address, VL53L0X_REG_RESULT_RANGE_STATUS, 12, data => {
            const result = this.parseResult(data);
            callback(result);
        }, once);
    }

    writeByteData (address, reg, value) {
        this.board.sendI2CConfig();
        this.board.i2cWriteReg(address, reg, value);
    }

    readByteData (address, reg) {
        return new Promise(function (resolve, reject) {
            this.readData(address, reg, 1, data => {
                resolve(data);
            });
        }.bind(this));
    }

    readData (address, reg, num, callback, once = true) {
        this.board.sendI2CConfig();
        if (once) {
            this.board.i2cReadOnce(address, reg, num, callback);
        } else {
            this.board.i2cRead(address, reg, num, callback);
        }
    }

    parseResult (data) {
        const res = {
            ambientCount: ((data[6] & 0xFF) << 8) | (data[7] & 0xFF),
            signalCount: ((data[8] & 0xFF) << 8) | (data[9] & 0xFF),
            distance: ((data[10] & 0xFF) << 8) | (data[11] & 0xFF),
            status: ((data[0] & 0x78) >> 3)
        };
        return res;
    }
}

module.exports = config => new VL53L0X(config);
