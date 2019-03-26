import moment from 'moment'
import axios from 'axios'
import { BaseModel } from './BaseModel'
import { ConfigModel } from './ConfigModel'
import { StatRoundModel } from './StatRoundModel'
import { HeraGameRecordModel } from './HeraGameRecordModel'
import { Tables } from '../lib/all'

export class CronRoundLongModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.PlayerBillDetail,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    /**
     * 统计写入局表
     */
    async cronRoundUG(inparam) {
        let time1 = Date.now()
        let self = this
        // 1，从配置中获取未结算序号中最小的
        let [queryErr, queryRet] = await new ConfigModel().queryLastTime({ code: 'roundLongLast' })
        queryRet = queryRet || { code: 'roundLongLast' }
        let sortNo = queryRet.ugUnSettlementArr && queryRet.ugUnSettlementArr.length > 0 ? queryRet.ugUnSettlementArr[0] : 0
        // 2，查询第三方游戏接口
        console.log(`UG查询起始序号：${sortNo - 1}`)
        const res = await axios.get(`https://${process.env.ANOTHER_GAME_CENTER}/ug/betpage/${sortNo - 1}`)
        // 3，遍历第三方注单，组装获取局列表
        let time2 = Date.now()
        let promiseArr = await self.getRoundAll(res.data)
        let allData = await Promise.all(promiseArr)
        let roundAll = allData.filter(v => v.betCount == 1)
        let ugUnSettlementArr = allData.filter(v => v.betCount != 1)
        console.log(`所有并发，查询总耗时：${Date.now() - time2}`)
        // 4，组装，批量写入局表和战绩表，使用等待，避免写入量太大
        let time3 = Date.now()
        await new StatRoundModel().batchWriteRound(roundAll)
        await new HeraGameRecordModel().batchWriteRound(roundAll)
        console.log(`所有数据，插入总耗时：${Date.now() - time3}`)
        // 5，更新配置
        if (ugUnSettlementArr.length < 1) {
            let lastSortNo = sortNo
            if (res.data && res.data[res.data.length - 1]) {
                lastSortNo = res.data[res.data.length - 1].SortNo + 1
            }
            ugUnSettlementArr.push(lastSortNo)
        }
        queryRet.ugUnSettlementArr = ugUnSettlementArr
        new ConfigModel().putItem(queryRet).then(res => {
            console.log(`更新配置成功`)
        }).catch(err => {
            console.error(`更新配置失败`)
            console.log(err)
        })
        console.log(`所有循环，执行总耗时：${Date.now() - time1}`)
    }

    // 内部方法：组装局列表
    async getRoundAll(inparam) {
        let self = this
        let promiseArr = []
        if (!inparam || inparam.length == 0) {
            return promiseArr
        }
        console.log(`UG查询返回条目：${inparam.length}`)
        for (let item of inparam) {
            let bets = await self.queryBk({ bk: `BUG_${item.Account}_${item.BetID}` })
            if (!bets || bets.length < 1) {
                continue
            }
            let p = new Promise(async function (resolve, reject) {
                // 处理已结算第三方注单
                if (item.Status > 1) {
                    // 如果通过BK只查询到下注流水，则补充返回流水，并插入新一局数据
                    let bet = bets[0]                           // NA下注流水
                    let anotherGameData = JSON.stringify(item)  // 第三方对应数据
                    // 更新下注流水的anotherGameData
                    new StatRoundModel().updateAnotherGameData(bet.businessKey, anotherGameData)
                    // 计算返回数据
                    let betAmount = bet.amount                                                  // 下注金额         
                    let retAmount = item.BackAmount                                             // 返回金额
                    let winloseAmount = parseFloat((retAmount + betAmount).toFixed(2))          // 输赢金额（正负相加）
                    let winAmount = inparam.Status == 2 ? retAmount : 0.0                       // 返奖金额
                    let refundAmount = inparam.Status == 2 ? 0.0 : retAmount                    // 退款金额
                    // let mixAmount = item.Turnover                                               // 洗码量
                    let mixAmount = Math.min(Math.abs(betAmount), Math.abs(winloseAmount))      // 洗码量
                    let ret = self.getBetRet(bet, item, retAmount)                              // 返回流水
                    let content = ret ? { bet: bets, ret } : { bet: bets }                      // 封装下注和返回对象
                    // 组装单局数据
                    resolve({
                        businessKey: bet.businessKey,
                        parent: bet.parent,
                        userName: bet.userName,
                        userId: +bet.userId,
                        createdAt: bet.createdAt,
                        createdDate: +moment(bet.createdAt).utcOffset(8).format('YYYYMMDD'),
                        createdStr: bet.createdStr,
                        betCount: 1,
                        originalAmount: bet.originalAmount,
                        betAmount: betAmount,
                        retAmount: retAmount,
                        winAmount: winAmount,
                        refundAmount: refundAmount,
                        winloseAmount: winloseAmount,
                        mixAmount: mixAmount,
                        gameType: +bet.gameType,
                        roundId: bet.roundId,
                        content: content,
                        anotherGameData: anotherGameData
                    })
                }
                // 未结算注单保存下次处理
                else {
                    resolve(item.SortNo)
                }
            })
            promiseArr.push(p)
        }
        return promiseArr
    }

    // 内部方法，通过下注和返回金额，获取返回流水
    getBetRet(bet, item, retAmount) {
        if (retAmount == 0) {
            return null
        }
        let ret = { ...bet }
        // 正常结算
        if (item.Status == 2) {
            ret.type = 4
        }
        // 退款
        else {
            ret.type = 5
        }
        ret.action = 1
        ret.amount = retAmount
        ret.balance = parseFloat((bet.balance + retAmount).toFixed(2))
        ret.createdAt = new Date(moment(item.UpdateTime, 'MM-DD-YYYY HH:mm:ss').utcOffset(8)).getTime()
        ret.createdDate = moment(ret.createdAt).utcOffset(8).format('YYYY-MM-DD')
        ret.createdStr = moment(ret.createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        ret.sn = bet.sn + '_RET'
        ret.txnid = bet.txnid + '_RET'
        ret.updatedAt = Date.now()
        return [ret]
    }

    // 内部方法：查询bk对应的下注的数据
    async queryBk(inparam) {
        const ret = await this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey=:businessKey',
            FilterExpression: '#type=:type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':businessKey': inparam.bk,
                ':type': 3
            }
        })
        return ret.Items
    }
}
