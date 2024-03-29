const BaseModel = require('./BaseModel')
const LogModel = require('./LogModel')
const moment = require('moment')

/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class PlayerBillDetailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'PlayerBillDetail'
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: 'NULL!'
        }
    }

    /**
     * 检查非下注流水是否超时
     * @param {*} inparam 
     */
    checkExpire(bkBet, inparam) {
        const now = Date.now()
        if (now - bkBet.Items[0].createdAt > 170000) {
            new LogModel().add('3', 'flowerror', inparam, `接收流水时间【${moment(now).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】对应BK【${inparam.businessKey}】的最早下注时间【${moment(bkBet.Items[0].createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】, 延迟【${now - bkBet.Items[0].createdAt}毫秒】`, bkBet.Items[0].createdAt)
        }
    }

    /**
     * 获取单项账单流水
     * @param {*} userName 
     */
    getBill(sn) {
        return this.getItem({
            ConsistentRead: true,
            ProjectionExpression: 'parent,userId,userName,amount,balance,gameType,gameId,businessKey,createdAt',
            Key: { 'sn': sn }
        })
    }

    /**
     * 查询对应BK的下注
     * @param {*} inparam 
     */
    queryBkBet(inparam) {
        return this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            ProjectionExpression: 'createdAt,gameId',
            KeyConditionExpression: 'businessKey = :businessKey',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: { '#type': 'type' },
            ExpressionAttributeValues: {
                ':businessKey': inparam.businessKey,
                ':type': 3
            }
        })
    }

    /**
     * 查询对应的BK数据
     * @param {*} inparam 
     */
    queryBk(inparam) {
        return this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey=:businessKey',
            ExpressionAttributeValues: { ':businessKey': inparam.bk }
        })
    }

    /**
     * YSB派彩检查
     * @param {*} inparam 
     */
    async ysbPayoutCheck(inparam) {
        const ret = await this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            ProjectionExpression: 'sn',
            KeyConditionExpression: 'businessKey = :businessKey',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: { '#type': 'type' },
            ExpressionAttributeValues: {
                ':businessKey': inparam.businessKey,
                ':type': 4
            }
        })
        // YSB的返奖需要判断返奖的TRX是否相同
        if (ret && ret.Items && ret.Items.length > 0) {
            // 计算累计派彩，如果遇到有相同ID的派彩，则直接返回退出
            let payoutSum = 0
            for (let item of ret.Items) {
                if (item.sn == `AYSB_${inparam.txnidTemp}`) {
                    return false
                }
                payoutSum += item.amount
            }
            // 如果需要扣除派彩，需要检查不能超额扣款
            if (inparam.amt < 0 && inparam.amt + payoutSum < 0) {
                new LogModel().add('2', 'ysbpayout', inparam, `YSB扣款超额,对应BK【${inparam.businessKey}】,时间【${Date.now()}】`)
                return false
            }
            // 派彩存在的情况下，再次派不同的彩，则日志记录派彩修正
            new LogModel().add('2', 'ysbfix', inparam, `YSB进行返奖修正,对应BK【${inparam.businessKey}】,时间【${Date.now()}】`)
        }
        return true
    }
}
