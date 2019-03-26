const Tables = require('../lib/Model').Tables
const BaseModel = require('./BaseModel')
const StatRoundDayModel = require('./StatRoundDayModel')
const StatRoundModel = require('./StatRoundModel')
// const UserModel = require('./UserModel')
const PlayerModel = require('./PlayerModel')
const Cache = require('../lib/Cache')
const moment = require('moment')
const _ = require('lodash')
const config = require('config')

class UserRankStatModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.UserRankStat,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 触发统计排行榜缓存
     */
    async eventPlayerRank() {
        const env = config.na.apidomain == 'webgame.na12345.com' ? 'PROD' : 'DEV'
        // 业务操作
        let nowTime = Date.now()
        let mondayTime = parseInt(moment().utcOffset(8).startOf('isoWeek').valueOf())           //周一零点零时时间戳
        let monday = parseInt(moment().utcOffset(8).startOf('isoWeek').format('YYYYMMDD'))      //周一日期
        let day = parseInt(moment().utcOffset(8).format('E'))                                   //获取当前星期几
        // 非周一，则统计周一至今的所有玩家排行榜
        let createdAt = [mondayTime, nowTime]            //定义查询时间范围
        let queryDay = []                                //定义天表查询范围
        if (day >= 2) {
            queryDay = [monday, parseInt(moment(mondayTime + (day - 2) * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD'))]
            createdAt = [parseInt(moment(mondayTime + (day - 1) * 24 * 60 * 60 * 1000).utcOffset(8).valueOf()), nowTime]     //重新赋值局表查询时间范围
        }
        console.log(`【排行榜】查询天表时间为${queryDay};查询局表的时间createdAt为${createdAt}`)
        const allPlayerList = await new PlayerModel().scanByNickname()
        const playerList = _.filter(allPlayerList, function (v) {
            if (v.updateAt >= mondayTime && v.updateAt <= nowTime) {
                return v
            }
        })
        //以父级用户分组
        // let groupParent = _.groupBy(playerList, 'parent')
        // let parentPromise = []
        // for (let parent in groupParent) {
        //并发所有父级
        // let p1 = new Promise(async function (resolve, reject) {
        //获取玩家的上级是正式还是测试
        // let userInfo = await new UserModel().queryUserById(parent)
        // let isTest = userInfo.isTest ? 1 : 0
        let promiseArr = []
        for (let player of playerList) {
            let p = new Promise(async function (resolve, reject) {
                let sp1 = null
                if (!_.isEmpty(queryDay)) {
                    //查局天表
                    sp1 = new StatRoundDayModel().getPlayerDay({ createdDate: queryDay, userName: player.userName })
                } else {
                    sp1 = new Promise((resolve, reject) => {
                        resolve({ betAmount: 0, betCount: 0, winAmount: 0 })
                    })
                }
                //查询局表
                let sp2 = new StatRoundModel().getPlayerRound({ createdAt: createdAt, userName: player.userName })
                let [roundDayRes, roundRes] = await Promise.all([sp1, sp2])
                //汇总数据
                let playerInfo = {
                    ...player,
                    balance: +player.balance.toFixed(2),
                    bet: +(roundDayRes.betAmount + roundRes.betAmount).toFixed(2),
                    betCount: roundDayRes.betCount + roundRes.betCount,
                    win: +(roundDayRes.winAmount + roundRes.winAmount).toFixed(2)
                    // isTest: isTest
                }
                resolve(playerInfo)
            })
            promiseArr.push(p)
        }
        //并发执行
        let finalRes = await Promise.all(promiseArr)
        // resolve(finParent)
        // })
        // parentPromise.push(p1)
        // }
        // let finalRes = await Promise.all(parentPromise)
        //内存排序
        for (let player of allPlayerList) {
            if (_.findIndex(finalRes, function (o) { return o.userId == player.userId }) == -1) { // 没找到有查询结果的数据，模拟push一条
                player.bet = 0
                player.betCount = 0
                player.win = 0
                finalRes.push(player)
            }
        }
        // REDIS缓存写入
        const cache = new Cache()
        await cache.set(`NA_${env}_PLAYER_RANK`, { list: finalRes, expire: Date.now() + 3 * 60 * 1000 })
        cache.quit()
    }

    /**
     * 清空排行榜
     */
    async delRank() {
        const [err, ret] = await this.scan({})
        console.log(`需要清空的数据有${ret.Items.length}`)
        for (let item of ret.Items) {
            await this.deleteItem({
                Key: {
                    'userName': item.userName
                }
            })
        }
        return ret.Items.length
    }

    // /**
    //  * 触发统计排行榜
    //  */
    // async cronPlayerRank() {
    //     let nowTime = Date.now()
    //     let mondayTime = parseInt(moment().utcOffset(8).startOf('isoWeek').valueOf())           //周一零点零时时间戳
    //     let monday = parseInt(moment().utcOffset(8).startOf('isoWeek').format('YYYYMMDD'))      //周一日期
    //     let day = parseInt(moment().utcOffset(8).format('E'))                                   //获取当前星期几

    //     // 周一零点10分前，清空所有排行榜
    //     if (nowTime > mondayTime && nowTime < (mondayTime + 10 * 60 * 1000)) {
    //         //清空排行榜
    //         await this.delRank()
    //     }
    //     // 非周一，则统计周一至今的所有玩家排行榜
    //     let createdAt = [mondayTime, nowTime]            //定义查询时间范围
    //     let queryDay = []                                //定义天表查询范围
    //     if (day >= 2) {
    //         queryDay = [monday, parseInt(moment(mondayTime + (day - 2) * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD'))]
    //         createdAt = [parseInt(moment(mondayTime + (day - 1) * 24 * 60 * 60 * 1000).utcOffset(8).valueOf()), nowTime]     //重新赋值局表查询时间范围
    //     }
    //     console.log(`【排行榜】查询天表时间为${queryDay};查询局表的时间createdAt为${createdAt}`)
    //     //查出所有本周上线的玩家
    //     const playerList = await new PlayerModel().scanWeekOnline({ mondayTime, nowTime })
    //     //以父级用户分组
    //     let groupParent = _.groupBy(playerList, 'parent')
    //     for (let parent in groupParent) {
    //         //获取玩家的上级是正式还是测试
    //         let userInfo = await new UserModel().queryUserById(parent)
    //         let isTest = userInfo.isTest ? 1 : 0
    //         let promiseArr = []
    //         for (let player of groupParent[parent]) {
    //             let p = new Promise(async function (resolve, reject) {
    //                 let roundDayRes = { betAmount: 0, betCount: 0, winAmount: 0 }
    //                 if (!_.isEmpty(queryDay)) {
    //                     //查局天表
    //                     roundDayRes = await new StatRoundDayModel().getPlayerDay({ createdDate: queryDay, userName: player.userName })
    //                 }
    //                 //查询局表
    //                 let roundRes = await new StatRoundModel().getPlayerRound({ createdAt: createdAt, userName: player.userName })
    //                 //汇总数据
    //                 let playerInfo = {
    //                     userId: player.userId,
    //                     userName: player.userName,
    //                     nickname: player.nickname,
    //                     headPic: player.headPic,
    //                     balance: player.balance,
    //                     bet: roundDayRes.betAmount + roundRes.betAmount,
    //                     betCount: roundDayRes.betCount + roundRes.betCount,
    //                     win: roundDayRes.winAmount + roundRes.winAmount,
    //                     parent: player.parent,
    //                     isTest: isTest
    //                 }
    //                 //写入玩家排行榜表
    //                 new UserRankStatModel().putItem(playerInfo)
    //                 resolve(player.userName)
    //             })
    //             promiseArr.push(p)
    //         }
    //         //并发执行
    //         await Promise.all(promiseArr)
    //     }
    //     console.log(`【排行榜】本周上线玩家数量：${playerList.length}，统计结束`)
    // }
}

module.exports = UserRankStatModel
