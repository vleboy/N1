const athena = require("../libs/athena")
const LogModel = require('../models/LogModel')
const NP = require('number-precision')
module.exports = class BillCheck {
    //流水账单检查
    check(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "sn", type: "S" },          //唯一流水号
            { name: "roundId", type: "NS" },    //大局号（可选）
            { name: "businessKey", type: "S" }, //回合号（下注和返奖一致）
            { name: "userId", type: "N" },      //玩家id
            { name: "gameType", type: "N" },    //游戏大类
            { name: "gameId", type: "N" },      //具体游戏id
            { name: "billType", type: "N", min: 3, max: 5 },    //流水类型（3下注，4返奖，5返还）
            { name: "amt", type: "N" }          //流水金额（下注为负数，返奖为正数）
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        if (inparam.billType == 3) {
            inparam.amt = Math.abs(NP.round(inparam.amt, 2)) * -1  //两位小数数学处理
        } else {
            inparam.amt = Math.abs(NP.round(inparam.amt, 2))
        }
        inparam.userId = +inparam.userId
        inparam.gameType = +inparam.gameType
        inparam.gameId = +inparam.gameId
        inparam.billType = +inparam.billType
        inparam.anotherGameData = JSON.stringify(inparam)
        // 返奖/返还检查
        if (inparam.billType != 3) {
            // 返奖/返还必须传递betsn
            if (!inparam.betsn) throw { params: 'betsn' }
            // 需要传gameRecord对象
            if (!inparam.gameRecord || typeof inparam.gameRecord != 'object') {
                console.error(`该返奖没有推送战绩【${inparam.businessKey}】`)
                new LogModel().add('2', 'flowerror', inparam, `该返奖没有推送战绩【${inparam.businessKey}】`)
                throw { params: 'gameRecord' }
            }
            // gameRecord对象内部betId与businessKey一致
            if (inparam.gameRecord.betId != inparam.businessKey) {
                console.error(`该返奖的战绩的betId和流水的businessKey不一致【${inparam.businessKey}】`)
                new LogModel().add('2', 'flowerror', inparam, `该返奖的战绩的betId和流水的businessKey不一致【${inparam.businessKey}】`)
                throw { params: 'gameRecord' }
            }
        }
    }
    //网页游戏认证接口检查
    checkAuth(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "plat", type: "S" },
            { name: "gameType", type: "N" },
            { name: "gameId", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (!inparam.plat || inparam.plat == 'NA') {
            inparam.userId = +inparam.userId
        }
        inparam.gameType = +inparam.gameType
        inparam.gameId = +inparam.gameId
    }
    //获取玩家余额参数校验
    checkPlayerBalance(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "buId", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.buId = +inparam.buId
    }
    //获取玩家游戏记录参数校验
    checkGameRecord(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "apiKey", type: "S", min: 1 },
            { name: "startTime", type: "N" },
            { name: "endTime", type: "N" },
            { name: "buId", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (inparam.startTime >= inparam.endTime) {
            throw { params: [inparam.startTime, inparam.endTime] }
        }
        if (inparam.endTime - inparam.startTime > 7 * 24 * 60 * 60 * 1000) {
            throw { params: '查询的时间范围不能超过7天' }
        }
        inparam.startTime = +inparam.startTime
        inparam.endTime = +inparam.endTime
        inparam.buId = +inparam.buId
        inparam.pageSize = 100
        // 默认按照派彩时间查询
        if (inparam.queryType != 0) {
            inparam.queryType = 1
        }
        // inparam.pageSize = inparam.pageSize ? +inparam.pageSize : 20
        // if (inparam.pageSize > 1000) {
        //     inparam.pageSize = 1000
        // }
    }
    //获取线路商游戏记录参数校验
    checkManagerGameRecord(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "apiKey", type: "S", min: 1 },
            { name: "startTime", type: "N" },
            { name: "endTime", type: "N" },
            { name: "managerId", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (inparam.startTime >= inparam.endTime) {
            throw { params: [inparam.startTime, inparam.endTime] }
        }
        if (inparam.endTime - inparam.startTime > 10 * 60 * 1000) {
            throw { params: '查询的时间范围不能超过10分钟' }
        }
        inparam.startTime = +inparam.startTime
        inparam.endTime = +inparam.endTime
        inparam.managerId = +inparam.managerId
    }
    //检查商户对玩家操作的参数校验
    checkMerchantPlayer(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "buId", type: "N" },
            { name: "apiKey", type: "S" },
            { name: "method", type: "S" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.buId = +inparam.buId
    }
    //检查玩家注册参数
    checkPlayerRegister(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userName", type: "S" },
            // { name: "userPwd", type: "S" },
            { name: "buId", type: "N" },
            { name: "apiKey", type: "S", min: 1 },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (typeof inparam.userName != 'string') {
            throw '请求参数userName错误'
        }
        if (!inparam.nickname && !inparam.userPwd) {
            throw '请求参数userPwd错误'
        }
        inparam.buId = +inparam.buId
        inparam.userName = inparam.userName.toString().trim()
    }
    //检查玩家获取token
    checkPlayerLoginToken(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userName", type: "S" },
            { name: "userPwd", type: "S" },
            { name: "buId", type: "N" },
            { name: "apiKey", type: "S", min: 1 },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (typeof inparam.userName != 'string') {
            throw { code: 10001, msg: '入参数据不合法', params: ['userName'] }
        }
        inparam.buId = +inparam.buId
        inparam.userName = inparam.userName.toString().trim()
    }
    //检查报表参数
    // checkgGameReport(inparam) {
    //     let [checkAttError, errorParams] = athena.Util.checkProperties([
    //         { name: "buId", type: "N", min: 1 },
    //         { name: "apiKey", type: "S" },
    //         { name: "gameType", type: "J" },
    //         { name: "startTime", type: "N" },
    //         { name: "endTime", type: "N" },
    //     ], inparam)
    //     if (checkAttError) {
    //         Object.assign(checkAttError, { params: errorParams })
    //         throw checkAttError
    //     }
    //     if (inparam.endTime < inparam.startTime) {
    //         throw { params: '结束时间不能小于开始时间' }
    //     }
    //     inparam.buId = +inparam.buId
    //     inparam.startTime = +inparam.startTime
    //     inparam.endTime = +inparam.endTime
    // }
}