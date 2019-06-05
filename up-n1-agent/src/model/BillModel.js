
const _ = require('lodash')
const NP = require('number-precision')
const moment = require('moment')
const BizErr = require('../lib/Codes').BizErr
const RoleModels = require('../lib/UserConsts').RoleModels
const Model = require('../lib/Model').Model
const config = require('config')
const BillMo = require('../lib/Model').BillMo
const BaseModel = require('./BaseModel')

class BillModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.PLATFORM_BILL,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: Model.StringValue,
            userId: Model.StringValue
        }
    }

    /**
     * 用户的账单流水
     * @param {*} initPoint 初始分
     * @param {*} userId 用户ID
     */
    async computeWaterfall(initPoint, userId,inparam) {
        let oldQuery = {
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ScanIndexForward: false,
            ExpressionAttributeValues: { ':userId': userId }
        }
        let bills = await this.bindFilterPage(oldQuery, {}, false, inparam)
        bills = bills.Items
        // 设定起始计算值
        let balanceSum = initPoint
        // 逐条流水计算
        const waterfall = _.map(bills, (item, index) => {
            balanceSum = NP.minus(balanceSum, bills[index].amount)
            return {
                ...bills[index],
                oldBalance: +balanceSum.toFixed(2),
                balance: +(NP.plus(balanceSum, bills[index].amount)).toFixed(2)
            }
        })
        return [waterfall, inparam.startKey]
    }

    /**
     * 查询用户余额
     * @param {*} user 
     */
    async checkUserBalance(user) {
        // 1、从缓存获取用户余额
        let initPoint = user.points
        let cacheRet = await this.query({
            TableName: config.env.TABLE_NAMES.SYSCacheBalance,
            KeyConditionExpression: 'userId = :userId AND #type = :type',
            ProjectionExpression: 'balance,lastTime',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':userId': user.userId,
                ':type': 'ALL'
            }
        })
        // 2、根据缓存是否存在进行不同处理，默认没有缓存查询所有
        let query = {
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ProjectionExpression: 'amount,createdAt',
            ExpressionAttributeValues: {
                ':userId': user.userId
            }
        }
        // 3、缓存存在，只查询后续流水
        if (cacheRet && !_.isEmpty(cacheRet.Items)) {
            // 获取缓存余额
            initPoint = cacheRet.Items[0].balance
            let lastTime = cacheRet.Items[0].lastTime
            // 根据最后缓存时间查询后续账单
            query = {
                IndexName: 'UserIdIndex',
                KeyConditionExpression: 'userId = :userId AND createdAt > :createdAt',
                ProjectionExpression: 'amount,createdAt',
                ExpressionAttributeValues: {
                    ':userId': user.userId,
                    ':createdAt': lastTime
                }
            }
        }
        let bills = await this.query(query)
        // 4、账单汇总
        const sums = _.reduce(bills.Items, (sum, bill) => {
            return sum + bill.amount
        }, 0.0)
        const balance = parseFloat((initPoint + sums).toFixed(2))
        // 5、更新用户余额缓存
        if (!_.isEmpty(bills.Items)) {
            new BaseModel().db$('put', {
                TableName: config.env.TABLE_NAMES.SYSCacheBalance,
                Item: { userId: user.userId, type: 'ALL', balance, lastTime: bills.Items[bills.Items.length - 1].createdAt }
            })
        }
        // 6、返回最后余额
        return balance
    }

    /**
     * 查询用户出账/入账金额
     * @param {*} user
     * @param {*} action 
     */
    async checkUserOutIn(user, action) {
        // 1、从缓存获取用户出账/入账
        let initPoint = 0
        let type = action == -1 ? 'OUT' : 'IN'
        let cacheRet = await new BaseModel().query({
            TableName: config.env.TABLE_NAMES.SYSCacheBalance,
            KeyConditionExpression: 'userId = :userId AND #type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':userId': user.userId,
                ':type': type
            }
        })
        // 2、根据缓存是否存在进行不同处理，默认没有缓存查询所有
        let query = {
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            FilterExpression: '#action = :action',
            ExpressionAttributeNames: {
                '#action': 'action'
            },
            ExpressionAttributeValues: {
                ':userId': user.userId,
                ':action': action
            }
        }
        // 3、缓存存在，只查询后续流水
        if (cacheRet && !_.isEmpty(cacheRet.Items)) {
            // 获取缓存出账/入账
            initPoint = cacheRet.Items[0].balance
            let lastTime = cacheRet.Items[0].lastTime
            // 根据最后缓存时间查询后续账单
            query = {
                IndexName: 'UserIdIndex',
                KeyConditionExpression: 'userId = :userId AND createdAt > :createdAt',
                FilterExpression: '#action = :action',
                ExpressionAttributeNames: {
                    '#action': 'action'
                },
                ExpressionAttributeValues: {
                    ':userId': user.userId,
                    ':createdAt': lastTime,
                    ':action': action
                }
            }
        }
        let bills = await this.query(query)
        // 4、账单汇总
        const sums = _.reduce(bills.Items, (sum, bill) => {
            return sum + bill.amount
        }, 0.0)
        // 5、更新用户出账缓存
        if (!_.isEmpty(bills.Items)) {
            cacheRet = await new BaseModel().db$('put', {
                TableName: config.env.TABLE_NAMES.SYSCacheBalance,
                Item: { userId: user.userId, type: type, balance: initPoint + sums, lastTime: bills.Items[bills.Items.length - 1].createdAt }
            })
        }
        // 6、返回最后出账
        return (initPoint + sums) * -1
    }

    /**
     * 转账
     * @param {*} from 
     * @param {*} billInfo 
     */
    async billTransfer(from, billInfo) {
        // 输入数据处理
        billInfo = _.omit(billInfo, ['sn', 'fromRole', 'fromUser', 'action'])
        // const to = await new UserModel().getUserByName(billInfo.toRole, billInfo.toUser)
        const Role = RoleModels[from.role]()
        if (!Role || Role.points === undefined) {
            throw BizErr.ParamErr('role error')
        }
        const fromInparam = _.pick({
            ...Role,
            ...from
        }, _.keys(Role))
        if (fromInparam.username == billInfo.toUser) {
            throw BizErr.ParamErr('不允许自我转账')
        }
        // 存储账单流水
        const Bill = {
            ...Model.baseModel(),
            ..._.pick({
                ...BillMo(),
                ...billInfo,
                fromUser: fromInparam.username,
                fromRole: fromInparam.role,
                fromLevel: fromInparam.level,
                fromDisplayName: fromInparam.displayName,
                action: 0,
                operator: from.operatorToken.username
            }, _.keys(BillMo()))
        }
        if (Bill.amount == 0) {
            return Bill
        }
        let batch = { RequestItems: {} }
        batch.RequestItems[config.env.TABLE_NAMES.PLATFORM_BILL] = [
            {
                PutRequest: {
                    Item: {
                        ...Bill,
                        amount: Bill.amount * (-1.0),
                        action: -1,
                        userId: from.userId
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        ...Bill,
                        amount: Bill.amount * (1.0),
                        action: 1,
                        userId: billInfo.toUserId
                    }
                }
            }
        ]
        await new BaseModel().batchWrite(batch)
        return Bill
    }

    /**
     * 玩家转账
     * @param {*} userBill
     * @param {*} playerBill 
     */
    async playerBillTransfer(userBill, playerBill) {
        userBill.createdAt = Date.now()
        userBill.updatedAt = Date.now()
        userBill.createdStr = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        userBill.createdDate = moment().utcOffset(8).format('YYYY-MM-DD')
        userBill.createdTime = moment().utcOffset(8).format('HH:mm:ss')
        playerBill.createdAt = Date.now()
        playerBill.updatedAt = Date.now()
        playerBill.createdStr = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        playerBill.createdDate = moment().utcOffset(8).format('YYYY-MM-DD')
        playerBill.createdTime = moment().utcOffset(8).format('HH:mm:ss')
        playerBill.businessKey = playerBill.sn
        let batch = { RequestItems: {} }
        batch.RequestItems[config.env.TABLE_NAMES.PLATFORM_BILL] = [{
            PutRequest: { Item: userBill }
        }]
        batch.RequestItems[config.env.TABLE_NAMES.PlayerBillDetail] = [{
            PutRequest: { Item: playerBill }
        }]
        return new BaseModel().batchWrite(batch)
    }
}

module.exports = BillModel