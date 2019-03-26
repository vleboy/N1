
const Util = require("../lib/athena").Util
class ConfigCheck {
    /**
     * 检查排队设置
     */
    checkQueue(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "status", type: "N", min: 0, max: 1 },
            { name: "countPeople", type: "N", min: 1, max: 1000 },
            { name: "countTime", type: "N", min: 1, max: 10000 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.status = parseInt(inparam.status)
        inparam.countPeople = parseInt(inparam.countPeople)
        inparam.countTime = parseInt(inparam.countTime)
    }

    /**
     * 检查包房配置
     */
    checkBFagent(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "banker", type: "N", min: 0, max: 50 },
            { name: "hedging", type: "N", min: 0, max: 50 },
            { name: "remain", type: "N", min: 0, max: 50 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.banker = parseInt(inparam.banker)
        inparam.hedging = parseInt(inparam.hedging)
        inparam.remain = parseInt(inparam.remain)
    }

    /**
     * 电子游戏配置
     */
    checkVideoConfig(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "code", type: "S", min: 1, max: 200 },
            { name: "businessKey", type: "S", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.code = inparam.code.toString()
        inparam.businessKey = inparam.businessKey.toString()

    }
    /**
     * 电子游戏配置
     */
    checkLobbyConfig(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "code", type: "S", min: 1, max: 200 },
            { name: "businessKey", type: "S", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.code = inparam.code.toString()
        inparam.businessKey = inparam.businessKey.toString()

        return [checkAttError, errorParams]
    }

    /**
     * 神秘大奖配置
     */
    checkMystery(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "livekill", type: "N", min: 0, max: 100 },
            { name: "videokill", type: "N", min: 0, max: 100 },
            { name: "arcadekill", type: "N", min: 1, max: 100 },
            { name: "avgLinePoint", type: "N", min: 1, max: 100 },
            { name: "awardPercent", type: "N", min: 1, max: 100 },
            { name: "beginLimit", type: "N", min: 1, max: 100000000 },
            { name: "upLimit", type: "N", min: 1, max: 100000000 },
            { name: "correctValue", type: "N", min: 1, max: 10000 },
            { name: "notifyLower", type: "N", min: 1, max: 100000000 },
            { name: "notifyInterval", type: "N", min: 5, max: 1000000 },
            { name: "notifyContent", type: "S", min: 1, max: 255 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.livekill = inparam.livekill || 0
        inparam.videokill = inparam.videokill || 0
        inparam.arcadekill = inparam.arcadekill || 0
        inparam.avgLinePoint = inparam.avgLinePoint || 0
        inparam.awardPercent = inparam.awardPercent || 0
        inparam.beginLimit = inparam.beginLimit || 1
        inparam.upLimit = inparam.upLimit || 1
        inparam.correctValue = inparam.correctValue || 0
        inparam.notifyLower = inparam.notifyLower || 1
        inparam.notifyInterval = inparam.notifyInterval || 5

        inparam.livekill = parseFloat(inparam.livekill)
        inparam.videokill = parseFloat(inparam.videokill)
        inparam.arcadekill = parseFloat(inparam.arcadekill)
        inparam.avgLinePoint = parseFloat(inparam.avgLinePoint)
        inparam.awardPercent = parseFloat(inparam.awardPercent)
        inparam.beginLimit = parseFloat(inparam.beginLimit)
        inparam.upLimit = parseFloat(inparam.upLimit)
        inparam.correctValue = parseFloat(inparam.correctValue)
        inparam.notifyLower = parseFloat(inparam.notifyLower)
        inparam.notifyInterval = parseFloat(inparam.notifyInterval)

        if (inparam.notifyLower < inparam.beginLimit || inparam.notifyLower > inparam.upLimit) {
            throw { "code": -1, "msg": "大奖池开始掉落额度<大奖池通知下限<大奖池额度上限", "params": ["notifyLower"] }
        }

    }
}

module.exports = ConfigCheck