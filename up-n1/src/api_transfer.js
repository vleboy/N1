// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const SysTransferModel = require('./model/SysTransferModel')
const UserModel = require('./model/UserModel')
const LogModel = require('./model/LogModel')
const CalcCheck = require('./biz/CalcCheck')
const GameTypeEnum = require('./lib/Consts').GameTypeEnum

/**
 * 共享钱包流水、交易记录查询接口
 * 分页查询的startKey值为上一次返回的startKey值
 */
router.post('/transferDetail', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //参数校验
    new CalcCheck().checkTransfer(inparam)
    //权限控制
    if (token.role != '1') {
        if (inparam.plat) {
            let isExist = false
            if (token.role == '10') {
                let userInfos = await new UserModel().listAllChildUsers(token)
                for (let userInfo of userInfos) {
                    if (userInfo.sn == inparam.plat) {
                        isExist = true
                    }
                }
            } else if (token.role == '100') {
                if (token.sn == inparam.plat) {
                    isExist = true
                }
            }
            if (!isExist) {
                throw { "code": -1, "msg": "不存在该接入方" }
            }
        }
        if (token.role == '100') {
            inparam.plat = token.sn
        } else {
            if (inparam.userId && !inparam.plat) {
                throw { "code": -1, "msg": "请输入接入方标识" }
            }
        }
    }
    //业务逻辑
    let pages = await new SysTransferModel().queryDetailPage(inparam)
    if (pages.Items.length > 0) {
        let lastItem = pages.Items[pages.Items.length - 1]
        if (inparam.plat) {
            pages.startKey = { businessKey: lastItem.businessKey, createdAt: lastItem.createdAt, plat: lastItem.plat, sn: lastItem.sn }
        } else if (inparam.userId) {
            pages.startKey = { businessKey: lastItem.businessKey, createdAt: lastItem.createdAt, userId: lastItem.userId, sn: lastItem.sn }
        }
    }
    delete pages.LastEvaluatedKey
    if (inparam.isRound) { //存在则为交易记录
        let newPages = []  //构造新返回的数据
        let bkPages = _.groupBy(pages.Items, 'businessKey')  //bk分组
        for (let bk in bkPages) {
            let orderBkPages = _.orderBy(bkPages[bk], ['createdAt'], ['asc']) //时间排序
            let betCount = 0
            let betAmount = 0       //下注总金额
            let winAmount = 0       //返奖总金额
            let refundAmount = 0    //返回总金额
            let content = []
            let statusArr = []
            for (let item of orderBkPages) {
                if (item.type == 3) {
                    betCount++
                    betAmount += item.amount
                } else if (item.type == 4) {
                    winAmount += item.amount
                } else if (item.type == 5) {
                    refundAmount += item.amount
                }
                statusArr.push(item.status)
                let newItem = _.clone(item)
                delete newItem.businessKey
                delete newItem.gameType
                delete newItem.gameId
                delete newItem.plat
                delete newItem.userId
                delete newItem.userNick
                content.push(newItem)
            }
            //判断条件 1.全Y，是Y  2.部分Y，是N  3.没Y，是E
            let status = 'Y'
            if (_.uniq(statusArr).length == 1) {
                status = statusArr[0]
            } else {
                if (_.indexOf(statusArr, 'Y') != -1) {
                    status = 'N'
                } else {
                    status = 'E'
                }
            }
            let winloseAmount = betAmount + winAmount + refundAmount    //输赢总金额
            let retAmount = winAmount + refundAmount                    //返还总金额
            newPages.push({
                plat: orderBkPages[0].plat,
                userNick: orderBkPages[0].userNick,
                userId: orderBkPages[0].userId,
                gameType: orderBkPages[0].gameType,
                gameId: orderBkPages[0].gameId,
                createdAt: orderBkPages[0].createdAt,
                status: status,
                businessKey: bk,
                betCount,
                betAmount: parseFloat(betAmount.toFixed(2)),
                winAmount: parseFloat(winAmount.toFixed(2)),
                winloseAmount: parseFloat(winloseAmount.toFixed(2)),
                retAmount: parseFloat(retAmount.toFixed(2)),
                refundAmount: parseFloat(refundAmount.toFixed(2)),
                content
            })
        }
        pages.Items = newPages
    }
    //结果返回
    ctx.body = { code: 0, payload: pages }
})

/**
 * 共享钱包报表接口
 */
router.post('/transferUserStat', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //参数校验
    new CalcCheck().checkTransfer(inparam)
    //权限控制
    let platRes = []        //返回结果
    let userSN = []         //接入商sn
    if (!inparam.plat) {    //不传plat 根据角色查询数据库获取
        if (token.role == '1') {
            userSN = await new UserModel().getUsersTranser()
        } else if (token.role == '10') {
            let userInfos = await new UserModel().listAllChildUsers(token)
            for (let userInfo of userInfos) {
                if (userInfo.role == '100') {
                    userSN.push(userInfo.sn)
                }
            }
        } else if (token.role == '100') {
            userSN.push(token.sn)
            inparam.plat = token.sn
        }
    } else { //传了 plat 校验该plat是否存在
        let isExist = false
        if (token.role == '1') {
            userSN = await new UserModel().getUsersTranser()
            for (let sn of userSN) {
                if (sn == inparam.plat) {
                    isExist = true
                    break
                }
            }
        } else if (token.role == '10') {
            let userInfos = await new UserModel().listAllChildUsers(token)
            for (let userInfo of userInfos) {
                if (userInfo.sn == inparam.plat) {
                    isExist = true
                    break
                }
            }
        } else if (token.role == '100') {
            if (token.sn == inparam.plat) {
                isExist = true
            }
        }
        if (!isExist) {
            throw { "code": -1, "msg": "不存在该接入方" }
        }
        userSN = [inparam.plat]
    }
    //查询 某个具体接入商下的玩家的汇总
    if (inparam.handleType == 'player') {
        let pages = await new SysTransferModel().queryDetailPage(inparam, false)
        //以玩家分组
        let userIdGroupBy = _.groupBy(pages.Items, 'userId')
        let promiseArr = []
        for (let userId in userIdGroupBy) {
            let p = new Promise(async (resolve, reject) => {
                let betCount = 0
                let betAmount = 0       //下注总金额
                let winAmount = 0       //返奖总金额
                let refundAmount = 0    //返回总金额
                for (let item of userIdGroupBy[userId]) {
                    if (item.type == 3) {
                        betCount++
                        betAmount += item.amount
                    } else if (item.type == 4) {
                        winAmount += item.amount
                    } else if (item.type == 5) {
                        refundAmount += item.amount
                    }
                }
                let winloseAmount = betAmount + winAmount + refundAmount    //输赢总金额
                let retAmount = winAmount + refundAmount                    //返还总金额
                resolve({
                    plat: inparam.plat,
                    userId: userId,
                    userNick: userIdGroupBy[userId][0].userNick,
                    betCount,
                    betAmount: parseFloat(betAmount.toFixed(2)),
                    winAmount: parseFloat(winAmount.toFixed(2)),
                    winloseAmount: parseFloat(winloseAmount.toFixed(2)),
                    retAmount: parseFloat(retAmount.toFixed(2)),
                    refundAmount: parseFloat(refundAmount.toFixed(2)),
                })
            })
            promiseArr.push(p)
        }
        platRes = await Promise.all(promiseArr)
    }
    //查询 接入商的游戏汇总信息
    else {
        let promiseArr = []
        for (let sn of userSN) {
            let p = new Promise(async (resolve, reject) => {
                inparam.plat = sn
                let pages = await new SysTransferModel().queryDetailPage(inparam, false)
                let betCount = 0
                let betAmount = 0       //下注总金额
                let winAmount = 0       //返奖总金额
                let refundAmount = 0    //返回总金额
                for (let item of pages.Items) {
                    if (item.type == 3) {
                        betCount++
                        betAmount += item.amount
                    } else if (item.type == 4) {
                        winAmount += item.amount
                    } else if (item.type == 5) {
                        refundAmount += item.amount
                    }
                }
                let winloseAmount = betAmount + winAmount + refundAmount    //输赢总金额
                let retAmount = winAmount + refundAmount                    //返还总金额
                resolve({
                    plat: sn,
                    betCount,
                    betAmount: parseFloat(betAmount.toFixed(2)),
                    winAmount: parseFloat(winAmount.toFixed(2)),
                    winloseAmount: parseFloat(winloseAmount.toFixed(2)),
                    retAmount: parseFloat(retAmount.toFixed(2)),
                    refundAmount: parseFloat(refundAmount.toFixed(2)),
                })
            })
            promiseArr.push(p)
        }
        platRes = await Promise.all(promiseArr)
        for (let item of platRes) {
            let userInfo = await new UserModel().getUserBySN(item.plat)
            item.transferMap = userInfo.transferMap
            item.dispalyName = userInfo.dispalyName
        }
    }
    //结果返回
    ctx.body = { code: 0, payload: platRes }
})

/**
 * 共享钱包Map控制
 */
router.post('/transferMap', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //参数校验
    new CalcCheck().checkTransferMap(inparam)
    //权限控制
    if (token.role != '1') {
        throw { "code": -1, "msg": "权限不足" }
    }
    //业务逻辑
    let userInfo = await new UserModel().getUserBySN(inparam.plat)
    if (_.isEmpty(userInfo)) {
        throw { "code": -1, "msg": "商户不存在" }
    }
    let transferMap = userInfo.transferMap
    transferMap[inparam.gameType].topAmount = inparam.topAmount
    const ret = await new UserModel().updateItem({
        Key: { role: '100', userId: userInfo.userId },
        UpdateExpression: 'SET transferMap = :transferMap',
        ExpressionAttributeValues: {
            ':transferMap': transferMap
        }
    })
    // 操作日志记录
    inparam.operateAction = '更新接入方金额Map'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    //结果返回
    ctx.body = { code: 0, payload: ret }
})


module.exports = router