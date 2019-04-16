const BaseModel = require('./BaseModel')
const LogModel = require('./LogModel')
const moment = require('moment')
const config = require('config')

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
    async queryBk(inparam) {
        const ret = await this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey=:businessKey',
            ExpressionAttributeValues: { ':businessKey': inparam.bk }
        })
        return ret.Items
    }

    /**
     * 是否存在对应的BK下注数据
     * @param {*} inparam 
     */
    async isExistBkBet(inparam, type = 3) {
        const ret = await this.queryOnce({
            IndexName: 'BusinessKeyIndex',
            ProjectionExpression: 'createdAt',
            KeyConditionExpression: 'businessKey = :businessKey',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: { '#type': 'type' },
            ExpressionAttributeValues: {
                ':businessKey': inparam.businessKey,
                ':type': type
            }
        })
        // YSB的返奖需要判断返奖的TRX是否相同
        if (type == 4 && ret && ret.Items && ret.Items.length > 0) {
            //如果是rtg游戏 直接返回存在
            if (inparam.gameType == config.rtg.gameType) {
                return true
            }
            //如果是ysb 进一步校验
            let payoutSum = 0
            for (let item of ret.Items) {
                if (item.roundId == inparam.roundId) {
                    return true
                }
                payoutSum += item.amount
            }
            if (inparam.amt < 0 && inparam.amt + payoutSum < 0) {
                new LogModel().add('3', 'ysbpayout', inparam, `YSB扣款超额,对应BK【${inparam.businessKey}】,时间【${Date.now()}】`)
                return true
            }
            new LogModel().add('3', 'ysbfix', inparam, `YSB进行返奖修正,对应BK【${inparam.businessKey}】,时间【${Date.now()}】`)
            return false
        }
        // 判断下注是否重复直接返回结果
        if (!ret || !ret.Items || ret.Items.length < 1) {
            return false
        } else {
            return true
        }
    }
}
