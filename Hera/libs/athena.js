export const RegEnum = {

    URL: /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/,
    IP: /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/,

    // SUFFIX: /^[a-zA-z0-9]{1,6}$/,
    SUFFIX: /^[A-Za-z0-9]{3,5}$/,

    COMPANYNAME: /^[\u4E00-\u9FA5A-Za-z0-9]{2,20}$/,
    COMPANYDESC: /^[\u4E00-\u9FA5A-Za-z0-9]{2,200}$/,
    COMPANYCONTACT: /^[\u4E00-\u9FA5A-Za-z0-9]{2,16}$/,
    COMPANYCONTACTWAY: /^[0-9]{2,20}$/,

    USERNAME: /^[\u4E00-\u9FA5A-Za-z0-9_\-.@]{4,16}$/,
    HOSTNAME: /^[\u4E00-\u9FA5A-Za-z]{2,16}$/,

    EMAIL: /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/,

    RATE: /^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/,
    PRICE: /^[0-9]+([.]{1}[0-9]{1,2})?$/,

    NUMBER: /^[0-9]+$/
}

export class Util {
    static parseJSON(obj) {
        if (Object.is(typeof obj, "object")) return [null, obj];
        try {
            obj = JSON.parse(obj);
            return [null, obj];
        } catch (err) {
            return [new AError(CODES.JSON_FORMAT_ERROR), null];
        }
    }

    static checkProperty(value, type, min, max, equal) {
        switch (type) {
            case "S": {
                if (!value) return [new AError(CODES.INPARAM_ERROR), null];
                let strLength = value.length,
                    error = false;
                if (min && strLength < min) error = true;
                if (max && strLength > max) error = true;
                if (equal) error = !Object.is(value, equal);
                return error ? [new AError(CODES.INPARAM_ERROR), null] : [null, value];
            }
            case "N": {
                if (!value && value !== 0) return [new AError(CODES.INPARAM_ERROR), null];
                let [e, v] = this.parseNumber(value);
                if (e) return [e, 0];
                let error = false;
                if (min && v < min) error = true;
                if (max && v > max) error = true;
                if (equal) error = !Object.is(v, +equal);
                return error ? [new AError(CODES.INPARAM_ERROR), null] : [null, +value];
            }
            case "J": {
                if (!value) return [new AError(CODES.INPARAM_ERROR), null];
                return this.parseJSON(value);
            }
            case "REG": {
                if (!value) return [new AError(CODES.INPARAM_ERROR), null];
                return !equal.test(value) ? [new AError(CODES.INPARAM_ERROR), null] : [null, 0]
            }
            case "NS": {
                if (!value) {
                    return [null, 0]
                }
                let strLength = value.length, error = false
                if (min && strLength < min) error = true
                if (max && strLength > max) error = true
                if (equal) error = !Object.is(value, equal)
                return error ? [new AError(CODES.INPARAM_ERROR), null] : [null, 0]
            }
            case "NN": {
                if (!value) {
                    return [null, 0]
                }
                let [e, v] = this.parseNumber(value);
                if (e) return [e, 0];
                let error = false;
                if (min && v < min) error = true;
                if (max && v > max) error = true;
                if (equal) error = !Object.is(v, +equal);
                return error ? [new AError(CODES.INPARAM_ERROR), null] : [null, 0]
            }
            case "NREG": {
                if (!value) {
                    return [null, 0]
                }
                return !equal.test(value) ? [new AError(CODES.INPARAM_ERROR), null] : [null, 0]
            }
            default: {
                return [new AError(CODES.INPARAM_ERROR), null]
            }
        }
    }

    static checkProperties(properties, body) {
        let errorArray = []
        for (let i = 0; i < properties.length; i++) {
            let { name, type, min, max, equal } = properties[i];
            let value = body[name]
            let [checkErr,parseValue] = this.checkProperty(value, type, min, max, equal);
            if (checkErr) {
                errorArray.push(name);
            }else {
                body[name] = parseValue;
            }
        }
        return Object.is(errorArray.length, 0) ? [null, errorArray] :
            [new AError(CODES.INPARAM_ERROR), errorArray]
    }

    static parseNumber(v) {
        try {
            let value = +v;
            if (Number.isNaN(value)) return [new AError(CODES.INPARAM_ERROR), null]
            return [null, value];
        } catch (err) {
            return [new AError(CODES.INPARAM_ERROR), null];
        }
    }
}

class AError {
    constructor(code, msg) {
        this.code = code;
        this.msg = EMSG[code.toString()];
    }
}

const CODES = {
    JSON_FORMAT_ERROR: 10000,
    INPARAM_ERROR: 10001,
    DB_ERROR: 500
}

const EMSG = {
    "10000": "数据错误",
    "10001": "入参数据不合法",
    "500": "服务器错误"
}
