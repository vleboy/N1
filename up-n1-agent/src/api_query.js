// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const NP = require('number-precision')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const UserModel = require('./model/UserModel')
const PlayerModel = require('./model/PlayerModel')
const SysBillModel = require('./model/SysBillModel')
const PlayerBillModel = require('./model/PlayerBillModel')
const CalcCheck = require('./biz/CalcCheck')
const GameTypeEnum = require('./lib/Consts').GameTypeEnum
const Model = require('./lib/Model').Model

// 查询平台用户统计信息
router.post('/queryUserStat', async function (ctx, next) {
    let inparam = ctx.request.body
    inparam.token = ctx.tokenVerify
    let calcQuery = inparam.query
    delete inparam.query
    let finalRes = []
    // 业务操作
    if (inparam.userId) {
        let ret = await new UserModel().queryOne(inparam) // 查询单个用户统计
        finalRes = ret
        // 判断是否需要进一步查询报表 
        if (inparam.gameType) {
            inparam.query = calcQuery
            inparam.role = ret.role
            inparam.userIds = [ret.userId]
            let calcRes = await calcUserStat(inparam)
            finalRes = initValue({ ...ret, ...calcRes[0] })
        }
        ctx.body = { code: 0, payload: finalRes }
    } else {
        let ret = await new UserModel().queryChild(inparam) // 查询所有下级用户统计
        // 判断是否需要进一步查询报表
        if (inparam.gameType) {
            finalRes = []
            inparam.query = calcQuery
            let promiseArr = []
            let userGroup = _.groupBy(ret, 'role')
            // 遍历所有角色
            for (let role in userGroup) {
                // 每类角色所有用户合并
                inparam.role = role
                inparam.userIds = []
                for (let user of userGroup[role]) {
                    inparam.userIds.push(user.userId)
                }
                // 每类角色用户一个Promise请求
                if (inparam.userIds.length > 0) {
                    let p = new Promise(async (resolve, reject) => {
                        let res = await calcUserStat(inparam)
                        resolve(res)
                    })
                    promiseArr.push(p)
                }
            }
            // 所有角色用户并发
            let calcRes = await Promise.all(promiseArr)
            for (let arr of calcRes) {
                for (let item of arr) {
                    for (let user of ret) {
                        if (item.userId == user.userId) {
                            finalRes.push({ ...user, ...item })
                        }
                    }
                }
            }
        } else {
            finalRes = _.orderBy(ret, [(o) => { return o.companyList ? o.companyList.length : 0 }], ['asc'])
        }
        ctx.body = { code: 0, payload: finalRes }
    }
})

// 查询玩家用户统计信息（新版）
router.get('/queryPlayerStat', async (ctx, next) => {
    let inparam = { parentId: ctx.tokenVerify.userId, gameType: Object.keys(GameTypeEnum).map(o => +o) }
    // 业务操作
    let ret = await new UserModel().queryChildPlayer(inparam)
    // 判断是否需要进一步查询用户的报表
    // if (inparam.gameType) {
    let promiseArr = []
    let finalRes = []
    inparam.query = { createdAt: [ctx.request.query.startTime, ctx.request.query.endTime] }
    new CalcCheck().check(inparam)
    ret = ret.filter((o) => { return o.joinTime && o.joinTime > (inparam.query.createdAt[0] - 24 * 60 * 60 * 1000) && o.joinTime < Date.now() })
    // 每50个玩家并发查询一次
    let playerChunk = _.chunk(ret, 50)
    for (let playerArr of playerChunk) {
        inparam.gameUserNames = []
        for (let player of playerArr) {
            inparam.gameUserNames.push(player.userName)
        }
        if (inparam.gameUserNames.length > 0) {
            let p = new Promise(async (resolve, reject) => {
                const res = await new PlayerBillModel().calcPlayerStat(inparam)
                amountFixed(res)
                resolve(res)
            })
            promiseArr.push(p)
        }
    }
    let calcRes = await Promise.all(promiseArr)
    // 遍历所有结果组
    for (let arr of calcRes) {
        // 遍历单个结果组内的所有结果
        for (let item of arr) {
            // 遍历所有玩家
            for (let player of ret) {
                if (item.userName == player.userName) {
                    finalRes.push({ ...player, ...item })
                }
            }
        }
    }
    // }
    // 返回结果
    ctx.body = { code: 0, payload: finalRes }
})

// 查询玩家用户统计信息（旧版）
router.post('/queryPlayerStat', async function (ctx, next) {
    let inparam = ctx.request.body
    let calcQuery = inparam.query
    delete inparam.query
    let promiseArr = []
    // 业务操作
    let ret = await new UserModel().queryChildPlayer(inparam)
    let finalRes = ret
    // 判断是否需要进一步查询用户的报表 
    if (inparam.gameType) {
        finalRes = []
        inparam.query = calcQuery
        new CalcCheck().check(inparam)
        ret = ret.filter((o) => { return o.joinTime && o.joinTime > (inparam.query.createdAt[0] - 24 * 60 * 60 * 1000) && o.joinTime < Date.now() })
        // 每50个玩家并发查询一次
        let playerChunk = _.chunk(ret, 50)
        for (let playerArr of playerChunk) {
            inparam.gameUserNames = []
            for (let player of playerArr) {
                inparam.gameUserNames.push(player.userName)
            }
            if (inparam.gameUserNames.length > 0) {
                let p = new Promise(async (resolve, reject) => {
                    const res = await new PlayerBillModel().calcPlayerStat(inparam)
                    amountFixed(res)
                    resolve(res)
                })
                promiseArr.push(p)
            }
        }
        let calcRes = await Promise.all(promiseArr)
        // 遍历所有结果组
        for (let arr of calcRes) {
            // 遍历单个结果组内的所有结果
            for (let item of arr) {
                // 遍历所有玩家
                for (let player of ret) {
                    if (item.userName == player.userName) {
                        finalRes.push({ ...player, ...item })
                    }
                }
            }
        }
    }
    // 返回结果
    ctx.body = { code: 0, payload: finalRes }
})

// 查询所有有效玩家统计信息
router.post('/queryRealPlayerStat', async function (ctx, next) {
    let inparam = ctx.request.body
    inparam.gameUserNames = []
    let finalRes = []
    new CalcCheck().check(inparam)
    // 查出所有时间范围内上线的玩家
    inparam.time0 = inparam.query.createdAt[0] - 24 * 60 * 60 * 1000 // 往前推一天查询，确保时间段内产生流水的玩家不会少
    inparam.time1 = inparam.query.createdAt[1]
    let playerArr = await new PlayerModel().scanOnline(inparam)
    // 以父级分组，查询每个父级是测试还是正式
    let groupParent = _.groupBy(playerArr, 'parent')
    let parentPromise = []
    for (let userId in groupParent) {
        let p1 = new Promise(async function (resolve, reject) {
            let parent = await new UserModel().queryUserById(userId)
            groupParent[userId].map((v) => {
                v.isTest = parent.isTest ? 1 : 0
                v.parent = parent.userId
                v.parentSn = parent.sn
                v.parentName = parent.username
                v.parentDisplayName = parent.displayName
                if (inparam.isTest != 0 || (inparam.isTest == 0 && parent.isTest != 1)) {
                    inparam.gameUserNames.push(v.userName)
                }
            })
            resolve(groupParent[userId])
        })
        parentPromise.push(p1)
    }
    // 并发所有父级查询
    playerArr = _.flatten(await Promise.all(parentPromise))
    // 所有玩家并发查询
    const calcRes = await new PlayerBillModel().calcPlayerStat(inparam)
    amountFixed(calcRes)
    // 遍历所有结果组
    for (let item of calcRes) {
        // 遍历所有玩家
        for (let player of playerArr) {
            if (item.userName == player.userName) {
                let itemObj = { ...player, ...item }
                if (itemObj.gameTypeMap) {
                    for (let key in itemObj.gameTypeMap) {
                        itemObj.gameTypeMap[key].gameTypeName = GameTypeEnum[key].name
                    }
                }
                finalRes.push(itemObj)
            }
        }
    }
    finalRes = _.orderBy(finalRes, ['isTest', 'parent', 'betCount', 'winloseAmount'], ['asc', 'asc', 'desc', 'desc'])
    // 返回结果
    ctx.body = { code: 0, payload: finalRes }
})

// 查询代理用户时间范围内的天统计
router.post('/query/agentDayStat', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //参数校验
    new CalcCheck().checkParentDayStat(inparam)
    if (Model.isAgentAdmin(token)) { //是代理管理员
        inparam.parentId = '01'
        if (inparam.username) {
            let agentInfo = await new UserModel().getUserByName('1000', inparam.username)
            inparam.parentId = agentInfo.userId
        }
    } else {
        inparam.parentId = token.userId
    }
    //业务处理
    let userArr = await new UserModel().queryAgentId(inparam)
    let promiseArr = []
    for (let user of userArr) {
        inparam.parentId = user.userId
        promiseArr.push(new PlayerBillModel().calcParentDayStat(inparam))
    }
    let res = _.flattenDeep(await Promise.all(promiseArr))
    //以时间分组 获取每天的统计
    let groupDay = _.groupBy(res, 'createdDate')
    let finalRes = []
    for (let day in groupDay) {
        let createdDate = day
        let betAmount = 0
        let betCount = 0
        let mixAmount = 0
        let refundAmount = 0
        let retAmount = 0
        let winAmount = 0
        let winloseAmount = 0
        for (let item of groupDay[day]) {
            betAmount = NP.plus(betAmount, item.betAmount)
            betCount = NP.plus(betCount, item.betCount)
            mixAmount = NP.plus(mixAmount, item.mixAmount)
            refundAmount = NP.plus(refundAmount, item.refundAmount)
            retAmount = NP.plus(retAmount, item.retAmount)
            winAmount = NP.plus(winAmount, item.winAmount)
            winloseAmount = NP.plus(winloseAmount, item.winloseAmount)
        }
        finalRes.push({ createdDate, betAmount: Math.abs(betAmount), betCount, mixAmount, refundAmount, retAmount, winAmount, winloseAmount })
    }
    // 返回结果
    ctx.body = { code: 0, payload: finalRes }
})
// 查询玩家时间范围内的天统计
router.post('/query/playerDayStat', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new CalcCheck().checkPlayerDayStat(inparam)
    //业务处理
    if (inparam.userId) {
        let playerInfo = await new PlayerModel().getPlayerById(inparam.userId)
        inparam.userName = playerInfo.userName
    }
    const res = await new PlayerBillModel().calcPlayerDayStat(inparam)
    // 返回结果
    ctx.body = { code: 0, payload: res }
})

// 内部方法：计算平台角色用户报表
async function calcUserStat(inparam) {
    new CalcCheck().check(inparam)
    // 业务操作
    switch (inparam.role) {
        case '1000':
            const ret1000 = await new SysBillModel().calcAgentStat(inparam)
            let filterRes1000 = []
            for (let item of ret1000) {
                if (item.betCount > 0) {
                    filterRes1000.push(item)
                }
            }
            amountFixed(filterRes1000)
            return filterRes1000
        case '-1000':
            const ret = await new SysBillModel().calcAgentAdminStat(inparam)
            amountFixed(ret)
            return ret
    }
}

// 内部方法：小数处理
function amountFixed(ret) {
    for (let item of ret) {
        item.betAmount = +item.betAmount.toFixed(4)
        if (item.retAmount) {
            item.retAmount = +item.retAmount.toFixed(4)
        }
        if (item.winAmount) {
            item.winAmount = +item.winAmount.toFixed(4)
        }
        if (item.refundAmount) {
            item.refundAmount = +item.refundAmount.toFixed(4)
        }
        if (item.winloseAmount) {
            item.winloseAmount = +item.winloseAmount.toFixed(4)
        }
        if (item.mixAmount) {
            item.mixAmount = +item.mixAmount.toFixed(4)
        }
        if (item.submitAmount) {
            item.submitAmount = +item.submitAmount.toFixed(4)
        }
        if (item.boundsSum) {
            item.boundsSum = +item.boundsSum.toFixed(4)
        }
        if (item.totalSum) {
            item.totalSum = +item.totalSum.toFixed(4)
        }
        if (item.gameTypeMap) {
            for (let key in item.gameTypeMap) {
                item.gameTypeMap[key].betAmount = +item.gameTypeMap[key].betAmount.toFixed(4)
                item.gameTypeMap[key].retAmount = +item.gameTypeMap[key].retAmount.toFixed(4)
                item.gameTypeMap[key].winAmount = +item.gameTypeMap[key].winAmount.toFixed(4)
                item.gameTypeMap[key].refundAmount = +item.gameTypeMap[key].refundAmount.toFixed(4)
                item.gameTypeMap[key].winloseAmount = +item.gameTypeMap[key].winloseAmount.toFixed(4)
                item.gameTypeMap[key].mixAmount = +item.gameTypeMap[key].mixAmount.toFixed(4)
                if (item.gameTypeMap[key].submitAmount) {
                    item.gameTypeMap[key].submitAmount = +item.gameTypeMap[key].submitAmount.toFixed(4)
                }
                if (item.gameTypeMap[key].boundsSum) {
                    item.gameTypeMap[key].boundsSum = +item.gameTypeMap[key].boundsSum.toFixed(4)
                }
                if (item.gameTypeMap[key].totalSum) {
                    item.gameTypeMap[key].totalSum = +item.gameTypeMap[key].totalSum.toFixed(4)
                }
            }
        }
    }
}

// 内部方法：初始化报表数值
function initValue(item) {
    item.betCount = item.betCount || 0
    item.betAmount = item.betAmount || 0
    item.retAmount = item.retAmount || 0
    item.winAmount = item.winAmount || 0
    item.refundAmount = item.refundAmount || 0
    item.winloseAmount = item.winloseAmount || 0
    item.mixAmount = item.mixAmount || 0
    item.submitAmount = item.submitAmount || 0
    item.boundsSum = item.boundsSum || 0
    item.totalSum = item.totalSum || 0
    return item
}


module.exports = router