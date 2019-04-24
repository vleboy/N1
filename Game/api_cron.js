const { ResOK, ResErr } = require('./lib/Response')
const CronRoundModel = require('./model/CronRoundModel')
const StatRoundDayModel = require('./model/StatRoundDayModel')

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

//     // cronRoundLong,                  // 定时汇总长延迟游戏局表
// }