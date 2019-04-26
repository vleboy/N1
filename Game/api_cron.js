const { ResOK, ResErr } = require('./lib/Response')
const CronRoundModel = require('./model/CronRoundModel')
const StatRoundDayModel = require('./model/StatRoundDayModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
/**
 * 定时汇总新游戏局
 */
module.exports.cronRound = async (e, c, cb) => {
    try {
        //1,获取入参
        const inparam = JSON.parse(e.body || "{}")
        // 业务操作
        if (inparam.startTime) {
            if (inparam.startTime + 1 * 60 * 60 * 1000 <= inparam.endTime) {
                return ResErr(cb, { code: -1, msg: "修正时间范围不能超过一个小时" })
            }
            console.log(`修复开元棋牌时间为${inparam.startTime}-${inparam.endTime}`)
            await new HeraGameRecordModel().getKYRecord(inparam.startTime, inparam.endTime)
        } else {
            await new CronRoundModel().cronLast()
        }
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
