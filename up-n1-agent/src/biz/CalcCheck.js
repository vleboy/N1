
const Util = require("../lib/athena").Util
class CalcCheck {
    /**
     * 检查入参
     */
    check(inparam) {
        // let [checkAttError, errorParams] = Util.checkProperties([
        //     { name: "sortkey", type: "S", min: 3, max: 7 },
        //     { name: "userName", type: "S", min: 1, max: 99999 }
        // ], inparam)
        // if (checkAttError) {
        //     Object.assign(checkAttError, { params: errorParams })
        //     throw checkAttError
        // }
        // 初始化游戏类型查询对象
        inparam.gameTypeObj = {}
        // 如果游戏类型是数组，则组装数组内所有项为查询对象
        if (inparam.gameType instanceof Array) {
            inparam.gameType.forEach((value, index) => {
                inparam.gameTypeObj[`:${value}`] = parseInt(value)
            })
        }
        // 默认使用游戏类型作为查询对象
        else {
            inparam.gameType = parseInt(inparam.gameType)
            inparam.gameTypeObj[`:${inparam.gameType}`] = inparam.gameType
        }
        // 数据类型处理
        if (inparam.query && inparam.query.createdAt) {
            inparam.query.createdAt[0] = parseInt(inparam.query.createdAt[0])
            inparam.query.createdAt[1] = parseInt(inparam.query.createdAt[1].toString().substring(0, 10) + '999')
        }
    }
    //代理日报表
    checkParentDayStat(inparam){
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "username", type: "NS" },
            { name: "startTime", type: "N" },
            { name: "endTime", type: "N" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (inparam.startTime > inparam.endTime) {
            inparam.startTime = inparam.endTime
        }
    }
    //玩家日报表检查
    checkPlayerDayStat(inparam){
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userName", type: "NS" },
            { name: "userId", type: "NN" },
            { name: "startTime", type: "N" },
            { name: "endTime", type: "N" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        //startTime 20190101
        if (inparam.startTime > inparam.endTime) {
            inparam.startTime = inparam.endTime
        }
    }
}

module.exports = CalcCheck