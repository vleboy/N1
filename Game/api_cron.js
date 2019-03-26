import { ResOK, ResErr } from './lib/all'
import { CronRoundModel } from './model/CronRoundModel'
import { StatRoundDayModel } from './model/StatRoundDayModel'
import { UserRankStatModel } from './model/UserRankStatModel'
import _ from 'lodash'
// import { CronRoundLongModel } from './model/CronRoundLongModel'

/**
 * 定时汇总新游戏局
 */
const cronRound = async (e, c, cb) => {
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
const cronRoundDay = async (e, c, cb) => {
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
const cronRegisterPlayer = async (e, c, cb) => {
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

export {
    cronRound,                      // 定时汇总游戏局
    cronRoundDay,                   // 定时汇总一天的局表
    cronRegisterPlayer,             // 定时统计注册的玩家数量

    // cronRoundLong,                  // 定时汇总长延迟游戏局表
}