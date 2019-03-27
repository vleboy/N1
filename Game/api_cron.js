const { ResOK, ResErr } = require('./lib/Response')
const CronRoundModel = require('./model/CronRoundModel')
const StatRoundDayModel = require('./model/StatRoundDayModel')
const UserRankStatModel = require('./model/UserRankStatModel')
const _ = require('lodash')

/**
 * 定时汇总新游戏局
 */
module.exports.cronRound = async (e, c, cb) => {
    try {
        // 业务操作
        await new CronRoundModel().cronLast()
        // 返回结果
        return ResOK(cb, { payload: 'success' })
    } catch (error) {
        console.error(`定时汇总局表出现异常`)
        console.error(error)
        return ResErr(cb, error)
    }
}

/**
 * 定时汇总一天的局表
 */
module.exports.cronRoundDay = async (e, c, cb) => {
    try {
        // 业务操作
        await new StatRoundDayModel().cronRoundDay()
        // 返回结果
        return ResOK(cb, { payload: 'success' })
    } catch (error) {
        console.error(`定时汇总局天表出现异常`)
        console.error(error)
        return ResErr(cb, error)
    }
}

/**
 * 以用户为角度统计玩家注册数量
 * params.start 2017-9-27
 * params.end   2018-02-01
 * params.nowTime 模拟今天时间戳
 */
module.exports.cronRegisterPlayer = async (e, c, cb) => {
    try {
        let inparam = { isinit: false }
        if (e && e.body && _.isString(e.body)) {
            inparam = JSON.parse(e.body)
            if (!inparam.nowTime) {
                inparam.isinit = true
            }
        }
        await new UserRankStatModel().cronRegisterPlayer(inparam)
        return ResOK(cb, { payload: 'success' })
    } catch (error) {
        console.error(error)
        return ResErr(cb, error)
    }
}

// /**
//  * 定时汇总长延时游戏局表
//  */
// const cronRoundLong = async (e, c, cb) => {
//     try {
//         // 业务操作
//         await new CronRoundLongModel().cronRoundUG()
//         // 返回结果
//         return ResOK(cb, { payload: 'success' })
//     } catch (error) {
//         console.error(`定时汇总常时延游戏出现异常`)
//         console.error(error)
//         return ResErr(cb, error)
//     }
// }

// module.exports = {
//     cronRound,                      // 定时汇总游戏局
//     cronRoundDay,                   // 定时汇总一天的局表
//     cronRegisterPlayer,             // 定时统计注册的玩家数量

//     // cronRoundLong,                  // 定时汇总长延迟游戏局表
// }