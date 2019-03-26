
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
            inparam.query.createdAt[1] = parseInt(inparam.query.createdAt[1].toString().substring(0, 10) + '999')
        }
    }
    //查询na接入第三方流水信息接口校验
    checkTransfer(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "plat", type: "NS", min: 2, max: 10 },
            { name: "userId", type: "NS", min: 1, max: 99999 },
            { name: "status", type: "NS", min: 1, max: 1 },
            { name: "gameType", type: "NS", min: 1, max: 6 }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.startTime = inparam.startTime ? parseInt(inparam.startTime) : 1538323200000  //默认2018-10-01开始
        inparam.endTime = inparam.endTime ? parseInt(inparam.endTime.toString().substring(0, 10) + '999') : Date.now()
        inparam.status = inparam.status == 'A' ? null : inparam.status
        inparam.gameType = inparam.gameType == 'A' ? null : +inparam.gameType
        if (inparam.startTime > inparam.endTime) {
            inparam.startTime = inparam.endTime
        }
    }
    //map控制
    checkTransferMap(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "plat", type: "S", min: 2, max: 10 },
            { name: "gameType", type: "N", min: 10000, max: 900000000 },
            { name: "topAmount", type: "NN" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
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
    //商户日报表检查
    checkMerchantDayStat(inparam){
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "displayId", type: "NN" },
            { name: "sn", type: "NS" },
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
    //日报表检查
    checkParentDayStat(inparam){
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "suffix", type: "NS" },
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
}

module.exports = CalcCheck