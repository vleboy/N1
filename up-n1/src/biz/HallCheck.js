const athena = require("../lib/athena")
class HallCheck {
    //进入游戏接口检查
    checkBuyTool(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userId", type: "N" },
            { name: "num", type: "N" },
            { name: "amount", type: "N" },
            { name: "seatId", type: "S" },
            { name: "kindId", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.userId = +inparam.userId
        inparam.num = +inparam.num
        inparam.amount = +inparam.amount
        inparam.seatId = inparam.seatId.toString()
        inparam.kindId = inparam.kindId.toString()
    }
    //获取商户信息
    checkUserInfo(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "parentId", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //检查跑马灯信息
    checkNoticeInfo(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "noid", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //检查邮件信息
    checkEmailInfo(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "emid", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //排行榜入参检查
    checkRank(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "sortkey", type: "S", min: 3, max: 7 },
            { name: "userName", type: "S", min: 1, max: 99999 }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //玩家id获取游戏检查
    checkPlayerId(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userId", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.userId = +inparam.userId
    }
}
module.exports = HallCheck