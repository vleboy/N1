
const Util = require("../lib/athena").Util
const NP = require('number-precision')
class AgentPlayerCheck {
    /**
     * 玩家 存点|提点 参数检查
     */
    checkDeposit(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "toUser", type: "S" },
            { name: "amount", type: "N", min: 1 }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.amount = NP.round(+inparam.amount, 2)
    }
    //玩家存提点操作
    //type:1 针对玩家，2，针对代理
    checkPoints(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "fromUser", type: "S" },
            { name: "toUser", type: "S" },
            { name: "amount", type: "N" },
            { name: "action", type: "N" },
            { name: "type", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.amount = NP.round(+inparam.amount, 2)
        inparam.action = +inparam.action
        inparam.type = +inparam.type
    }
}

module.exports = AgentPlayerCheck