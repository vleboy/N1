const Util = require("../lib/athena").Util
class PlayerBillCheck {
    /**
     * 检查转账数据
     */
    checkBill(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userName", type: "S" }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        if (inparam.startKey && typeof inparam.startKey == 'string') {
            inparam.startKey = JSON.parse(inparam.startKey)
        }
        inparam.pageSize = inparam.pageSize ? +inparam.pageSize : 1000
        inparam.startTime = inparam.startTime ? +inparam.startTime : 0
        inparam.endTime = inparam.endTime ? +inparam.endTime : Date.now()
        inparam.endTime = parseInt(inparam.endTime.toString().substring(0, 10) + '999')
        if (inparam.startTime > inparam.endTime) {
            inparam.startTime = inparam.endTime
        }
    }
    //玩家列表入参检查
    checkPlayerList(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "gameId", type: "NS" },
            { name: "userName", type: "NS" },
            { name: "nickname", type: "NS" },
            { name: "suffix", type: "NS" },
            { name: "buId", type: "NN" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //解冻 冻结玩家
    checkPlayerForzen(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "state", type: "N" },
            { name: "userName", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.state = +inparam.state
        if (inparam.state != 0 && inparam.state != 1) {
            throw { params: ['state'] }
        }
    }
    //玩家交易详情
    checkPlayerDetail(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userName", type: "S" },
            { name: "startTime", type: "N" },
            { name: "endTime", type: "N" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        if (inparam.startTime > inparam.endTime) {
            throw { params: [inparam.startTime, inparam.endTime] }
        }
        inparam.startTime = +inparam.startTime
        inparam.endTime = parseInt(inparam.endTime.toString().substring(0, 10) + '999')
    }
    //玩家信息
    checkPlayerInfo(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userName", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //获取商户玩家信息
    checkMerchantPlayer(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userId", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //玩家战绩
    checkPlayerRecord(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userName", type: "S" },
            { name: "betId", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //流水下载
    checkBillDown(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userName", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.startTime = inparam.startTime ? +inparam.startTime : 0
        inparam.endTime = inparam.endTime ? parseInt(inparam.endTime.toString().substring(0, 10) + '999') : Date.now()
        if (inparam.startTime > inparam.endTime) {
            inparam.startTime = inparam.endTime
        }
    }
}

module.exports = PlayerBillCheck