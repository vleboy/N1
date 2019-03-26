const athena = require("../libs/athena")
const LogModel = require('../models/LogModel')
const NP = require('number-precision')
export class BillCheck {
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
        // NA街机退款处理
        if (inparam.gameType == 50000 && inparam.billType == 5) {
            inparam.isArcadeRefund = true
            inparam.gameRecord = { betId: inparam.businessKey }
        }
        // 返奖/返还检查
        if (inparam.billType != 3) {
            // 指定游戏，返奖/返还必须传递betsn
            if (inparam.gameType == 30000 || inparam.gameType == 40000 || inparam.gameType == 70000 || inparam.gameType == 90000) {
                if (!inparam.betsn) throw { params: 'betsn' }
            }
            // 需要传gameRecord对象
            if (!inparam.gameRecord || typeof inparam.gameRecord != 'object') {
                console.error(`该返奖没有推送战绩【${inparam.businessKey}】`)
                new LogModel().add('2', 'flowerror', inparam, `该返奖没有推送战绩【${inparam.businessKey}】`)
                throw { params: 'gameRecord' }
            }
            // 除了捕鱼，gameRecord对象内部betId与businessKey一致
            if (inparam.gameType != 60000 && inparam.gameRecord.betId != inparam.businessKey) {
                console.error(`该返奖的战绩的betId和流水的businessKey不一致【${inparam.businessKey}】`)
                new LogModel().add('2', 'flowerror', inparam, `该返奖的战绩的betId和流水的businessKey不一致【${inparam.businessKey}】`)
                throw { params: 'gameRecord' }
            }
        }
    }
    checkNALive(inparam) {
        let snRepeatMap = {}
        let bkRepeatMap = {}
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userId", type: "N" },      //玩家id
            { name: "gameType", type: "N" },    //游戏大类
            { name: "gameId", type: "N" },      //具体游戏id
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.userId = +inparam.userId
        inparam.gameType = +inparam.gameType
        inparam.gameId = +inparam.gameId
        inparam.anotherGameData = JSON.stringify(inparam)
        // 遍历所有单次所有流水
        for (let i = 0; i < inparam.records.length; i++) {
            let item = inparam.records[i]
            item.isFirst = i == 0 ? true : false    // 是否首条流水
            if (snRepeatMap[item.sn]) {
                throw { params: 'sn重复' }
            }
            if (bkRepeatMap[item.businessKey]) {
                throw { params: 'businessKey重复' }
            }
            snRepeatMap[item.sn] = true
            snRepeatMap[item.businessKey] = true
            if (!item.sn) {
                throw { params: 'records.sn' }
            }
            if (!item.businessKey) {
                throw { params: 'records.businessKey' }
            }
            if (item.billType < 3 || item.billType > 5) {
                throw { params: 'records.billType' }
            }
            // 数据类型处理
            if (item.billType == 3) {
                item.amt = Math.abs(NP.round(item.amt, 2)) * -1
                inparam.totalBetAmt = NP.plus(inparam.totalBetAmt, item.amt)  // 所有下注金额
                // inparam.totalBetAmt += item.amt     // 所有下注金额
            } else {
                item.amt = Math.abs(NP.round(item.amt, 2))
            }
            item.billType = +item.billType
            item.userId = inparam.userId
            item.gameType = inparam.gameType
            item.gameId = inparam.gameId
            item.anotherGameData = inparam.anotherGameData
            if (item.billType == 4 || (item.billType == 5 && item.gameRecord)) {   //返奖需要传gameRecord
                if (!item.gameRecord || typeof item.gameRecord != 'object') {
                    console.error(`该返奖没有推送战绩【${inparam.businessKey}】`)
                    new LogModel().add('2', 'flowerror', inparam, `该返奖没有推送战绩【${inparam.businessKey}】`)
                    throw { params: 'records.gameRecord' }
                }
                if (item.gameRecord.betId != item.businessKey) {
                    console.error(`该返奖的战绩的betId和流水的businessKey不一致【${inparam.businessKey}】`)
                    new LogModel().add('2', 'flowerror', inparam, `该返奖的战绩的betId和流水的businessKey不一致【${inparam.businessKey}】`)
                    throw { params: 'records.gameRecord' }
                }
            }
            if (item.billType == 5 && !item.gameRecord) {
                item.gameRecord = {}
                item.isLiveRefund = true
            }
        }
    }
    //进入游戏接口检查
    checkJoinGame(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "gameId", type: "N" },
            { name: "sid", type: "S" },  //服务器id
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (inparam.userId) {
            inparam.userId = +inparam.userId
        }
        inparam.gameId = +inparam.gameId
        inparam.sid = +inparam.sid
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
    //玩家离线接口参数校验
    checkPlayerExit(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "uids", type: "J" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //玩家登陆游戏参数校验
    checkPlayerLogin(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userName", type: "S" },  // 玩家帐号
            { name: "userId", type: "S" },    // 玩家所属用户ID
            { name: "userPwd", type: "S" }    // 玩家密码
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
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
        inparam.pageSize = inparam.pageSize ? +inparam.pageSize : 20                             //设置查询数量
        if (inparam.pageSize > 1000) {
            inparam.pageSize = 1000
        }
    }
    //检查玩家自行充值/提现参数校验
    checkBalanceHandler(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "buId", type: "N" },
            { name: "amount", type: "N", min: 0 },
            { name: "action", type: "N" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (inparam.action != 1 && inparam.action != -1) {
            throw { params: '入参【action】不合法' }
        }
        inparam.buId = +inparam.buId
        inparam.amount = NP.round(+inparam.amount, 2)
        inparam.action = +inparam.action
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
    //检查玩家修改密码参数
    checkPlayerPassword(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userPwd", type: "S" },
            { name: "buId", type: "S" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.buId = +inparam.buId
    }
    //检查大厅更新玩家信息
    checkUpdateInfo(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userId", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.userId = +inparam.userId
        inparam.sex = inparam.sex == 1 ? 1 : 2
    }
    //检查玩家的token是否正确
    checkPlayerToken(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "userName", type: "S" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //检查报表参数
    checkgGameReport(inparam) {
        let [checkAttError, errorParams] = athena.Util.checkProperties([
            { name: "buId", type: "N", min: 1 },
            { name: "apiKey", type: "S" },
            { name: "gameType", type: "J" },
            { name: "startTime", type: "N" },
            { name: "endTime", type: "N" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (inparam.endTime < inparam.startTime) {
            throw { params: '结束时间不能小于开始时间' }
        }
        inparam.buId = +inparam.buId
        inparam.startTime = +inparam.startTime
        inparam.endTime = +inparam.endTime
    }
}