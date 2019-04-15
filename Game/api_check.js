const { ResOK, ResErr } = require('./lib/Response')
const LogModel = require('./model/LogModel')
const StatRoundModel = require('./model/StatRoundModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const _ = require('lodash')
const moment = require('moment')
const axios = require('axios')
const jwt = require('jsonwebtoken')

/**
 * 检查和修正日志（将实际上正确的数据的确错误记录的延迟数据修正）
 */
module.exports.checkRound = async (e, c, cb) => {
    try {
        let fixArr = []
        let promiseAll = []
        let repeatMap = {}
        // 查出所有role=3且ret=N的日志
        const RoleRet1 = await new LogModel().roleQuery({ role: '3' })
        console.log(`一共查出role=3需要检验的日志条数${RoleRet1.length}`)
        // 查出所有role=4且ret=N的日志
        const  RoleRet2= await new LogModel().roleQuery({ role: '4' })
        console.log(`一共查出role=4需要检验的日志条数${RoleRet2.length}`)
        // 查出所有role=2且ret=N的日志
        const  RoleRet3 = await new LogModel().roleQuery({ role: '2' })
        console.log(`一共查出role=2需要检验的日志条数${RoleRet3.length}`)
        for (let item of RoleRet1) {
            let p = new Promise(async function (resolve, reject) {
                let bk = item.inparams.businessKey
                //查询局表中该bk数量
                let roundNumber = await new StatRoundModel().bkQuery({ bk })
                //查询流水中该bk数量
                let detailNumber = await new PlayerBillDetailModel().bkQuery({ bk })
                //如果数量相等，更新日志
                // if (roundNumber == detailNumber) {
                //     await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                // } else {
                    fixArr.push(item)
                // }
                resolve(1)
            })
            promiseAll.push(p)
        }
        for (let item of RoleRet2) {
            let p = new Promise(async function (resolve, reject) {
                let bk = item.inparams.businessKey
                let flag = false
                // 已重复bk，直接更新Y
                if (repeatMap[bk]) {
                    flag = true
                }
                // 检查是否已经统计 
                else {
                    repeatMap[bk] = true
                    flag = await new StatRoundModel().isAnotherGameDate({ bk })
                }
                //更新日志
                if (flag) {
                    await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                } else if (item.betTime) {
                    fixArr.push(item)
                }
                resolve(1)
            })
            promiseAll.push(p)
        }
        for (let item of RoleRet3) {
            if (item.type == 'findBetError') {
                let p = new Promise(async function (resolve, reject) {
                    let bk = item.inparams.businessKey
                    //查询流水中该bk数量
                    let detailNumber = await new PlayerBillDetailModel().bkQuery({ bk })
                    if (detailNumber == -1) {
                        await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                    }
                    resolve(1)
                })
                promiseAll.push(p)
            }
        }
        // 并发执行
        await Promise.all(promiseAll)
        console.log(`有${fixArr.length}条数据修正`)
        let start = 0, end = 0
        if (fixArr.length > 0) {
            let token = await jwt.sign({
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) * 3,
                iat: Math.floor(Date.now() / 1000) - 30
            }, process.env.TOKEN_SECRET)
            start = _.minBy(fixArr, 'betTime') ? +(_.minBy(fixArr, 'betTime').betTime) - 1 : new Date(`${_.minBy(fixArr, 'createdAt').createdDate}T00:00:00+08:00`).getTime()
            end = _.maxBy(fixArr, 'betTime') ? +(_.maxBy(fixArr, 'betTime').betTime) + 90000 : new Date(`${_.maxBy(fixArr, 'createdAt').createdDate}T23:59:59+08:00`).getTime()
            console.log(`请求修复时间为：${start}-${end}，${moment(start).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(end).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}`)
            axios.post(`https://${process.env.ANOTHER_GAME_CENTER}/stat/fixRound`, { start, end }, { headers: { 'Authorization': `Bearer ${token}` } })
        }
        // 返回结果
        return ResOK(cb, { payload: { start, end } })
    } catch (error) {
        console.error(error)
        return ResErr(cb, error)
    }
}

// module.exports = {
//     checkRound         // 检查和修正日志
// }