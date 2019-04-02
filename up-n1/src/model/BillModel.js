
const _ = require('lodash')
const moment = require('moment')
const BizErr = require('../lib/Codes').BizErr
const RoleModels = require('../lib/UserConsts').RoleModels
const Model = require('../lib/Model').Model
const config = require('config')
const BillMo = require('../lib/Model').BillMo
const BaseModel = require('./BaseModel')
const UserModel = require('./UserModel')
const PlayerBillModel = require('./PlayerBillModel')
const PlayerBillDetailModel = require('./PlayerBillDetailModel')
const LogModel = require('./LogModel')
const PlayerModel = require('./PlayerModel')

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
    async computeWaterfall(initPoint, userId) {
        const bills = await this.query({
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        })
        // 直接在内存里面做列表了. 如果需要进行缓存,以后实现
        let balanceSum = initPoint
        const waterfall = _.map(bills.Items, (item, index) => {
            // let balance = _.reduce(_.slice(bills.Items, 0, index + 1), (sum, item) => {
            //     return sum + item.amount
            // }, 0.0) + initPoint
            balanceSum += bills.Items[index].amount
            return {
                ...bills.Items[index],
                oldBalance: +(balanceSum - bills.Items[index].amount).toFixed(2),
                balance: +balanceSum.toFixed(2)
            }
        })
        return waterfall.reverse()
    }

    /**
     * 查询用户余额和最后一条账单记录
     * @param {*} user 
     */
    async checkUserLastBill(user) {
        // 查询最后一条账单记录
        // const bills = await this.queryOnce({
        //     IndexName: 'UserIdIndex',
        //     ScanIndexForward: false,
        //     Limit: 1,
        //     KeyConditionExpression: 'userId = :userId',
        //     ExpressionAttributeValues: {
        //         ':userId': user.userId
        //     }
        // })
        // 内部方法查询余额
        const ret = await this.checkUserBalance(user)
        // 返回最后一条账单记录和余额
        // let lastBill = bills.Items[0]
        const lastBill = { lastBalance: +ret.toFixed(2) }
        return lastBill
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
        // 5、更新用户余额缓存
        if (!_.isEmpty(bills.Items)) {
            new BaseModel().db$('put', {
                TableName: config.env.TABLE_NAMES.SYSCacheBalance,
                Item: { userId: user.userId, type: 'ALL', balance: initPoint + sums, lastTime: bills.Items[bills.Items.length - 1].createdAt }
            })
        }
        // 6、返回最后余额
        return initPoint + sums
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
    //看板售出查询
    async querySale(usersAdmin, userNames, tokenInfo, querytime) {
        //循环遍历每一个管理员，查出所对应的流水
        let promiseAll = []
        for (let user of usersAdmin) {
            let p = new Promise(async (resolve, reject) => {
                let billRes = await this.query({
                    IndexName: 'UserIdIndex',
                    KeyConditionExpression: 'userId = :userId AND createdAt BETWEEN :createdAt0 AND :createdAt1',
                    FilterExpression: `#action=:action AND toRole <>:toRole`, //排除给玩家的操作
                    ProjectionExpression: 'amount,toUser,createdDate',
                    ExpressionAttributeNames: {
                        '#action': 'action'
                    },
                    ExpressionAttributeValues: {
                        ':userId': user.userId,
                        ':action': -1,
                        ':createdAt0': querytime[0],
                        ':createdAt1': querytime[1],
                        ':toRole': '10000'
                    }
                })
                let newBill = []
                if (billRes && billRes.Items.length != 0) {
                    if (tokenInfo.role == '100') { //如果是商户直接返回
                        newBill = billRes.Items
                    } else { //只有管理员或者线路商才过滤是否是正式测试全部数据
                        //过滤掉不在userNames数组中的数据
                        for (let item of billRes.Items) {
                            if (_.indexOf(userNames, item.toUser) != -1) {
                                newBill.push(item)
                            }
                        }
                    }
                }
                resolve(newBill)
            })
            promiseAll.push(p)
        }
        return _.flatten(await Promise.all(promiseAll))
    }
    //看板收益 点数 玩家注册 相关查询
    async queryPoints(handlerType, usersInfo, inparam, querytime) {
        if (handlerType == 1) { //收益
            let promiseAll = []
            let playerBillModel = new PlayerBillModel()
            for (let userId of usersInfo.Items) {
                let p = new Promise(async (resolve, reject) => {
                    let now = +moment().utcOffset(8).format('YYYYMMDD')
                    let bills = []
                    if (now == querytime[1] && now != querytime[0]) { //说明是历史统计需要查局表和局天表
                        //查询局天表
                        let billRes = await playerBillModel.query({
                            IndexName: 'ParentIndex',
                            KeyConditionExpression: 'parent = :parent AND createdDate  BETWEEN :createdDate0 AND :createdDate1',
                            ProjectionExpression: 'winloseAmount,createdDate',
                            ExpressionAttributeValues: {
                                ':parent': userId.userId,
                                ':createdDate0': querytime[0],
                                ':createdDate1': querytime[1]
                            }
                        })
                        if (billRes && billRes.Items.length != 0) {
                            bills = _.concat(bills, billRes.Items)
                        }
                        //查询局表
                        let roundRes = await new BaseModel().query({
                            TableName: config.env.TABLE_NAMES.StatRound,
                            IndexName: 'ParentIndex',
                            KeyConditionExpression: 'parent = :parent AND createdAt between :createdAt0 AND :createdAt1',
                            ProjectionExpression: 'winloseAmount,createdDate',
                            ExpressionAttributeValues: {
                                ':parent': userId.userId,
                                ':createdAt0': moment().startOf('day').valueOf(),
                                ':createdAt1': Date.now()
                            }
                        })
                        if (roundRes && roundRes.Items.length != 0) {
                            bills = _.concat(bills, roundRes.Items)
                        }
                    } else if (now == querytime[1] && now == querytime[0]) { //说明是查今日的收益，查局表
                        //查询局表
                        let roundRes = await new BaseModel().query({
                            TableName: config.env.TABLE_NAMES.StatRound,
                            IndexName: 'ParentIndex',
                            KeyConditionExpression: 'parent = :parent AND createdAt between :createdAt0 AND :createdAt1',
                            ProjectionExpression: 'winloseAmount,createdDate',
                            ExpressionAttributeValues: {
                                ':parent': userId.userId,
                                ':createdAt0': moment().startOf('day').valueOf(),
                                ':createdAt1': Date.now()
                            }
                        })
                        if (roundRes && roundRes.Items.length != 0) {
                            bills = _.concat(bills, roundRes.Items)
                        }
                    } else { //只需要查局天表
                        //查询局天表
                        let billRes = await playerBillModel.query({
                            IndexName: 'ParentIndex',
                            KeyConditionExpression: 'parent = :parent AND createdDate  BETWEEN :createdDate0 AND :createdDate1',
                            ProjectionExpression: 'winloseAmount,createdDate',
                            ExpressionAttributeValues: {
                                ':parent': userId.userId,
                                ':createdDate0': querytime[0],
                                ':createdDate1': querytime[1]
                            }
                        })
                        if (billRes && billRes.Items.length != 0) {
                            bills = _.concat(bills, billRes.Items)
                        }
                    }
                    resolve(bills)
                })
                promiseAll.push(p)
            }
            return _.flatten(await Promise.all(promiseAll))
        } else if (handlerType == 2) { //点数消耗
            let promiseAll = []
            for (let userId of usersInfo.Items) {
                let p = new Promise(async (resolve, reject) => {
                    //查询局天表
                    let billRes = await new PlayerBillModel().query({
                        IndexName: 'ParentIndex',
                        KeyConditionExpression: 'parent = :parent AND createdDate  BETWEEN :createdDate0 AND :createdDate1',
                        ProjectionExpression: 'gameTypeData,winloseAmount,createdDate',
                        ExpressionAttributeValues: {
                            ':parent': userId.userId,
                            ':createdDate0': querytime[0],
                            ':createdDate1': querytime[1]
                        }
                    })
                    //查流水获取商城
                    let scbillRes = await new PlayerBillDetailModel().query({
                        IndexName: 'ParentIndex',
                        KeyConditionExpression: 'parent = :parent AND createdAt BETWEEN :createdAt0  AND :createdAt1',
                        ProjectionExpression: 'amount,createdDate,gameType',
                        FilterExpression: '#type=:type',
                        ExpressionAttributeNames: {
                            '#type': 'type'
                        },
                        ExpressionAttributeValues: {
                            ':parent': userId.userId,
                            ':createdAt0': inparam.startTime,
                            ':createdAt1': inparam.endTime,
                            ':type': 13
                        }
                    })
                    resolve([billRes.Items, scbillRes.Items])
                })
                promiseAll.push(p)
            }
            let finalRes = await Promise.all(promiseAll)
            let roundRes = [], scRes = []
            for (let item of finalRes) {
                roundRes = _.concat(roundRes, item[0])
                scRes = _.concat(scRes, item[1])
            }
            return [roundRes, scRes]
        } else if (handlerType == 3) { //玩家注册人数折线图
            let promiseAll = []
            for (let userId of usersInfo.Items) {
                let p = new Promise(async (resolve, reject) => {
                    //查询日志表中玩家历史注册数
                    let logRes = await new LogModel().query({
                        IndexName: 'LogRoleIndex',
                        KeyConditionExpression: '#role = :role AND createdAt  BETWEEN :createdAt0 AND :createdAt1',
                        FilterExpression: 'userId=:userId',
                        ProjectionExpression: 'dayCount,dayTotalCount,createdDate',
                        ExpressionAttributeNames: {
                            '#role': 'role'
                        },
                        ExpressionAttributeValues: {
                            ':userId': userId.userId,
                            ':createdAt0': inparam.startTime,
                            ':createdAt1': inparam.endTime,
                            ':role': '100000'
                        }
                    })
                    resolve(logRes.Items)
                })
                promiseAll.push(p)
            }
            return _.flatten(await Promise.all(promiseAll))
        } else if (handlerType == 4) {//在线玩家
            let promiseAll = []
            for (let userId of usersInfo.Items) {
                let p = new Promise(async (resolve, reject) => {
                    let billRes = await new PlayerModel().query({
                        IndexName: 'parentIdIndex',
                        KeyConditionExpression: '#parent = :parent',
                        ProjectionExpression: '#gameState,gameId',
                        ExpressionAttributeNames: {
                            '#gameState': 'gameState',
                            '#parent': 'parent'
                        },
                        ExpressionAttributeValues: {
                            ':parent': userId.userId
                        }
                    })
                    let totalPlayer = billRes.Items.length
                    let zaxianPlayer = 0
                    let gameId = []
                    if (billRes && billRes.Items.length != 0) {
                        for (let i of billRes.Items) {
                            if (i.gameState != 1) {
                                zaxianPlayer++
                                gameId.push(i.gameId)
                            }
                        }
                    }
                    resolve({ totalPlayer, zaxianPlayer, gameId })
                })
                promiseAll.push(p)
            }
            return _.flatten(await Promise.all(promiseAll))
        }
    }

}

module.exports = BillModel