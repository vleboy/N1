const athena = require("../lib/athena")
class HallCheck {
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