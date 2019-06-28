const _ = require('lodash')
const StatusEnum = require('../lib/UserConsts').StatusEnum
const BizErr = require('../lib/Codes').BizErr
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const Model = require('../lib/Model').Model
const config = require('config')
const BaseModel = require('./BaseModel')

class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.TABLE_MERCHANT,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: Model.StringValue,
            userId: Model.StringValue
        }
    }

    //获取代理下的子id
    async queryAgentId(inparam) {
        if (inparam.parentId == '01') {
            let queryParms = {
                KeyConditionExpression: "#role = :role",
                ProjectionExpression: 'userId',
                ExpressionAttributeNames: {
                    '#level': 'level',
                    '#role': 'role'
                }
            }
            if (inparam.isTest == 0) {              //只查正式
                queryParms.FilterExpression = '#level<>:level AND isTest <> :isTest'
                queryParms.ExpressionAttributeValues = {
                    ':level': 0,
                    ':isTest': 1,
                    ':role': '1000'
                }
            } else if (inparam.isTest == 1) {       //只查测试
                queryParms.FilterExpression = '#level<>:level AND isTest = :isTest'
                queryParms.ExpressionAttributeValues = {
                    ':level': 0,
                    ':isTest': 1,
                    ':role': '1000'
                }
            } else {                        //全查
                queryParms.FilterExpression = '#level<>:level'
                queryParms.ExpressionAttributeValues = {
                    ':level': 0,
                    ':role': '1000'
                }
            }
            let res = await this.query(queryParms)
            return res.Items
        } else {
            if (inparam.isAll) {  //查下级所有代理
                let queryParms = {
                    KeyConditionExpression: "#role = :role",
                    ProjectionExpression: 'userId',
                    ExpressionAttributeNames: {
                        '#levelIndex': 'levelIndex',
                        '#role': 'role'
                    }
                }
                if (inparam.isTest == 0) {              //只查正式
                    queryParms.FilterExpression = 'contains(#levelIndex,:levelIndex) AND isTest <> :isTest'
                    queryParms.ExpressionAttributeValues = {
                        ':levelIndex': inparam.parentId,
                        ':isTest': 1,
                        ':role': '1000'
                    }
                } else if (inparam.isTest == 1) {       //只查测试
                    queryParms.FilterExpression = 'contains(#levelIndex,:levelIndex) AND isTest = :isTest'
                    queryParms.ExpressionAttributeValues = {
                        ':levelIndex': inparam.parentId,
                        ':isTest': 1,
                        ':role': '1000'
                    }
                } else {                        //全查
                    queryParms.FilterExpression = 'contains(#levelIndex,:levelIndex)'
                    queryParms.ExpressionAttributeValues = {
                        ':levelIndex': inparam.parentId,
                        ':role': '1000'
                    }
                }
                let res = await this.query(queryParms)
                let userIdArr = res.Items
                userIdArr.unshift({ userId: inparam.parentId })
                return userIdArr
            } else { //查询自己
                return [{ userId: inparam.parentId }]
                // let queryParms = {
                //     IndexName: 'RoleParentIndex',
                //     ProjectionExpression: 'userId',
                //     KeyConditionExpression: '#role=:role AND #parent=:parent',
                //     ExpressionAttributeNames: {
                //         '#role': 'role',
                //         '#parent': 'parent'
                //     }
                // }
                // if (inparam.isTest == 0) {              //只查正式
                //     queryParms.FilterExpression = 'isTest <> :isTest'
                //     queryParms.ExpressionAttributeValues = {
                //         ':parent': inparam.parentId,
                //         ':isTest': 1,
                //         ':role': '1000'
                //     }
                // } else if (inparam.isTest == 1) {       //只查测试
                //     queryParms.FilterExpression = 'isTest = :isTest'
                //     queryParms.ExpressionAttributeValues = {
                //         ':parent': inparam.parentId,
                //         ':isTest': 1,
                //         ':role': '1000'
                //     }
                // } else {                        //全查
                //     queryParms.ExpressionAttributeValues = {
                //         ':parent': inparam.parentId,
                //         ':role': '1000'
                //     }
                // }
                // let res = await this.query(queryParms)
                // return res.Items.unshift({ userId: inparam.parentId })
            }
        }
    }

    /**
     * 查看可用代理
     */
    async listAvailableAgents(token, inparam) {
        // 查询所有可用代理
        const allAgent = {
            ProjectionExpression: 'userId,displayName',
            KeyConditionExpression: '#role = :role',
            FilterExpression: '#status = :status AND #level <> :level',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status',
                '#level': 'level'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Agent,
                ':status': StatusEnum.Enable,
                ':level': 0
            }
        }
        // 查询用户的所有可用代理
        const childAgent = {
            IndexName: "RoleParentIndex",
            ProjectionExpression: 'userId,displayName',
            KeyConditionExpression: '#role = :role',
            FilterExpression: '#status = :status AND (contains(levelIndex,:levelIndex) OR userId = :levelIndex)',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Agent,
                ':status': StatusEnum.Enable,
                ':levelIndex': inparam.parent
            }
        }
        let finalQueryRet = { Items: [] }
        if (!inparam.parent || inparam.parent == '01') {
            let queryRet = await this.query(allAgent)
            queryRet.Items.unshift({ userId: '01', displayName: '直属' })
            finalQueryRet = queryRet
        }
        else {
            let queryRet2 = await this.query(childAgent)
            finalQueryRet = queryRet2
        }
        // 按照层级排序
        const sortResult = _.sortBy(finalQueryRet.Items, ['level'])
        return sortResult
    }

    // 检查代理用户是否重复
    async checkUserBySuffix(role, suffix, username) {
        let ret = await this.query({
            IndexName: 'RoleUsernameIndex',
            KeyConditionExpression: '#username = :username and #role = :role',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#username': 'username'
            },
            ExpressionAttributeValues: {
                ':username': username,
                ':role': role
            }
        })
        if (ret.Items.length > 0) {
            return false
        } else {
            return true
        }
    }

    // 检查昵称是否重复
    async checkNickExist(role, displayName) {
        let ret = await this.query({
            KeyConditionExpression: '#role = :role',
            FilterExpression: '#displayName = :displayName',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#displayName': 'displayName'
            },
            ExpressionAttributeValues: {
                ':role': role,
                ':displayName': displayName
            }
        })
        if (ret.Items.length > 0) {
            return false
        } else {
            return true
        }
    }

    /**
     * 检查sn是否重复
     * @param {*} displayName 
     */
    async checkUserSn(sn) {
        let ret = await this.scan({
            FilterExpression: '#sn = :sn',
            ExpressionAttributeNames: {
                '#sn': 'sn'
            },
            ExpressionAttributeValues: {
                ':sn': sn
            }
        })

        if (ret.Items.length > 0) {
            return false
        } else {
            return true
        }
    }

        /**
     * 更新用户状态
     * @param {用户角色} role 
     * @param {用户ID} userId 
     * @param {需要变更的状态} status 
     */
    async changeStatus(role, userId, status, companyList) {
        let updateItem = {
            Key: {
                'role': role,
                'userId': userId
            },
            UpdateExpression: "SET #status = :status",
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': status
            }
        }
        if (companyList) {
            updateItem.UpdateExpression = 'SET #status = :status,companyList=:companyList'
            updateItem.ExpressionAttributeValues = {
                ':status': status,
                ':companyList': companyList
            }
        }
        return await this.updateItem(updateItem)
    }

    /**
     * 查询用户
     * @param {*} userId 
     * @param {*} role 
     */
    async getUser(userId, role) {
        const queryRet = await this.query({
            KeyConditionExpression: '#role = :role AND #userId = :userId',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#userId': 'userId'
            },
            ExpressionAttributeValues: {
                ':role': role,
                ':userId': userId
            }
        })
        if (queryRet.Items.length - 1 != 0) {
            throw BizErr.UserNotFoundErr()
        }
        const User = queryRet.Items[0]
        return User
    }

    /**
     * 根据角色查询
     * @param {*} inparam 
     */
    async queryByRole(inparam) {
        let query = {
            ProjectionExpression: 'userId,displayId,username,suffix,uanme,displayName,createdAt,updatedAt',
            KeyConditionExpression: '#role = :role',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': inparam.role
            }
        }
        // 条件搜索
        const queryRet = await this.bindFilterQuery(query, inparam.query, true)
        // 排序输出
        let sortResult = _.sortBy(queryRet.Items, [inparam.sortkey || 'createdAt'])
        if (inparam.sort == "desc") { sortResult = sortResult.reverse() }
        return sortResult
    }

    /**
     * 通过userId查询用户
     * @param {*} userId 
     */
    async queryUserById(userId) {
        const querySet = await this.query({
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        })
        if (querySet.Items.length - 1 != 0) {
            throw BizErr.UserNotFoundErr()
        }
        return querySet.Items[0]
    }

    /**
     * 根据角色和带前缀的用户名查询唯一用户
     * @param {*} role 
     * @param {*} username 
     */
    async getUserByName(role, username) {
        const queryRet = await this.query({
            IndexName: 'RoleUsernameIndex',
            KeyConditionExpression: '#role = :role and #username = :username',
            ExpressionAttributeNames: {
                '#username': 'username',
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':username': username,
                ':role': role
            }
        })
        const User = queryRet.Items[0]
        if (!User) {
            throw BizErr.UserNotFoundErr()
        }
        return User
    }

    /**
     * 用户更新
     * @param {*} userData 
     */
    async userUpdate(userData) {
        const updateRet = await this.putItem({
            ...userData,
            updatedAt: Date.now()
        })
        return updateRet
    }

    /**
     * 查询下级平台用户统计
     */
    async queryChild(inparam) {
        let ProjectionExpression = 'userId,suffix,uname,username,displayName,#role,#level,levelIndex,parent,parentDisplayName,parentName,parentRole,createdAt,rate,winloseAmountMap,gameList,companyList,sn,points'
        // 查询代理
        let query = {
            IndexName: 'RoleParentIndex',
            ProjectionExpression: ProjectionExpression,
            KeyConditionExpression: '#role=:role AND parent=:parent',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#level': 'level'
            }
        }
        if (inparam.isTest == 0) {              //只查正式代理
            query.FilterExpression = 'isTest<>:isTest'
            query.ExpressionAttributeValues = {
                ':role': inparam.token.role,
                ':parent': inparam.parent,
                ':isTest': 1
            }
        } else if (inparam.isTest == 1) {       //只查测试代理
            query.FilterExpression = 'isTest=:isTest'
            query.ExpressionAttributeValues = {
                ':role': inparam.token.role,
                ':parent': inparam.parent,
                ':isTest': inparam.isTest
            }
        } else {                                 //全查平台代理
            query.ExpressionAttributeValues = {
                ':role': inparam.token.role,
                ':parent': inparam.parent
            }
        }
        // 条件搜索
        if (inparam.sn) {
            query.KeyConditionExpression = '#role=:role',
                delete query.ExpressionAttributeValues[':parent']
            inparam.query = { sn: { $like: inparam.sn } }
        }
        const queryRet = await this.bindFilterQuery(query, inparam.query, false)
        // 排序输出
        let sortResult = _.sortBy(queryRet.Items, [inparam.sortkey || 'createdAt'])
        if (inparam.sort == "desc") { sortResult = sortResult.reverse() }
        return sortResult

    }

    /**
     * 查询玩家统计
     */
    async queryChildPlayer(inparam) {
        let query = {
            TableName: config.env.TABLE_NAMES.TABLE_USER,
            ProjectionExpression: 'userName,nickname,#parent,parentName,merchantName,createdAt,gameList,balance,#state,joinTime',
            IndexName: 'parentIdIndex',
            KeyConditionExpression: 'parent = :parentId',
            ExpressionAttributeNames: {
                '#parent': 'parent',
                '#state': 'state'
            },
            ExpressionAttributeValues: {
                ':parentId': inparam.parentId
            }
        }
        // 条件搜索
        const queryRet = await this.bindFilterQuery(query, inparam.query, true)
        // 排序输出
        let sortResult = _.sortBy(queryRet.Items, [inparam.sortkey || 'createdAt'])
        if (inparam.sort == "desc") { sortResult = sortResult.reverse() }
        return sortResult
    }

    /**
     * 查询平台用户统计
     */
    async queryOne(inparam) {
        let query = {
            IndexName: 'UserIdIndex',
            ProjectionExpression: 'userId,suffix,uname,username,displayName,#role,#level,levelIndex,parent,parentName,parentDisplayName,parentRole,createdAt,rate,winloseAmountMap,gameList,companyList,sn,points',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#level': 'level'
            },
            ExpressionAttributeValues: {
                ':userId': inparam.userId
            }
        }
        const queryRet = await this.query(query)
        const User = queryRet.Items[0]
        if (!User) {
            throw BizErr.UserNotFoundErr()
        }
        return User
    }

    /**
     * 查看所有下级用户
     * @param {*} token 
     */
    async listAllChildUsers(token) {
        let query = {
            FilterExpression: 'contains(#levelIndex,:levelIndex)',
            ProjectionExpression: 'userId,#role,#status,gameList,companyList',
            ExpressionAttributeNames: {
                '#levelIndex': 'levelIndex',
                '#status': 'status',
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':levelIndex': token.userId
            }
        }
        const queryRet = await this.scan(query)
        // 去除敏感数据（该方法不需要）
        // queryRet.Items = _.map(queryRet.Items, (item) => {
        //     item.passhash = null
        //     if (!Model.isPlatformAdmin(token)) {
        //         item.password = '********'
        //     }
        //     return item
        // })
        // 按照层级排序
        // const sortResult = _.sortBy(queryRet.Items, ['level'])
        return queryRet.Items
    }

    /**
     * 组织架构
     * @param {*} inparam 
     */
    async organize(inparam) {
        let ProjectionExpression = 'userId,suffix,uname,username,displayName,#role,#level,levelIndex,parent,parentName,parentDisplayName,parentRole,#status'
        let finalRet = {}
        if (inparam.type == 'admin') {
            // 默认查询平台组织架构（排除平台管理员，代理）
            let platfromQuery = {
                ProjectionExpression: ProjectionExpression,
                FilterExpression: '#role <> :role AND #level <> :level',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#level': 'level',
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':role': RoleCodeEnum.Agent,
                    ':level': 0,
                }
            }
            // 平台非管理员
            if (!Model.isPlatformAdmin(inparam.token)) {
                platfromQuery = {
                    ProjectionExpression: ProjectionExpression,
                    FilterExpression: '#role <> :role AND #level <> :level AND contains(#levelIndex,:levelIndex)',
                    ExpressionAttributeNames: {
                        '#role': 'role',
                        '#level': 'level',
                        '#levelIndex': 'levelIndex',
                        '#status': 'status'
                    },
                    ExpressionAttributeValues: {
                        ':role': RoleCodeEnum.Agent,
                        ':level': 0,
                        ':levelIndex': inparam.token.userId
                    }
                }
            }
            let queryRet = await this.scan(platfromQuery)
            finalRet = queryRet
        }
        // 查询代理组织架构
        if (inparam.type == 'agent') {
            let agentQuery = {
                ProjectionExpression: ProjectionExpression,
                KeyConditionExpression: '#role = :role',
                FilterExpression: '#level <> :level',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#level': 'level',
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':role': RoleCodeEnum.Agent,
                    ':level': 0,
                }
            }
            // 代理非管理员
            if (!Model.isAgentAdmin(inparam.token)) {
                agentQuery = {
                    ProjectionExpression: ProjectionExpression,
                    KeyConditionExpression: '#role = :role',
                    FilterExpression: '#level <> :level AND contains(#levelIndex,:levelIndex)',
                    ExpressionAttributeNames: {
                        '#role': 'role',
                        '#level': 'level',
                        '#levelIndex': 'levelIndex',
                        '#status': 'status'
                    },
                    ExpressionAttributeValues: {
                        ':role': RoleCodeEnum.Agent,
                        ':level': 0,
                        ':levelIndex': inparam.token.userId
                    }
                }
            }
            let queryRet = await this.query(agentQuery)
            finalRet = queryRet
        }

        // 组装组织架构的树状结构
        let organizeTree = []
        let childTree = []
        for (let item of finalRet.Items) {
            // 第一层
            if (item.level == parseInt(inparam.token.level) + 1) {
                let treeNode = { id: item.userId, parent: item.parent, name: item.displayName, username: item.username, children: [], role: item.role, level: item.level, status: item.status }
                organizeTree.push(treeNode)
            }
            // 剩余节点
            else {
                let treeNode = { id: item.userId, parent: item.parent, name: item.displayName, username: item.username, children: [], role: item.role, level: item.level, status: item.status }
                childTree.push(treeNode)
            }
        }
        tree(organizeTree, childTree)
        // 优化显示直属线路商和直属商户
        let topName = 'NA集团'
        if (!Model.isPlatformAdmin(inparam.token)) {
            topName = inparam.token.displayName
        }
        organizeTree = { id: '01', name: topName, children: organizeTree }
        if (inparam.type == 'admin' && Model.isPlatformAdmin(inparam.token)) {
            const directManagerNode = { name: '直属线路商', children: [] }
            const directMerchantNode = { name: '直属商户', children: [] }
            for (let directNode of organizeTree.children) {
                if (directNode.role == RoleCodeEnum.Manager) {
                    directManagerNode.children.push(directNode)
                } else if (directNode.role == RoleCodeEnum.Merchant) {
                    directMerchantNode.children.push(directNode)
                }
            }
            organizeTree.children = [directManagerNode, directMerchantNode]
        }
        return organizeTree
    }

    //查询指定父级的代理数量
    async count(parent) {
        let res = await this.query({
            IndexName: 'RoleParentIndex',
            KeyConditionExpression: '#role = :role AND parent = :parent',
            ProjectionExpression: 'userId',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Agent,
                ':parent': parent
            }
        })
        return res.Count
    }
}

/**
 * 组装树
 * @param {*} treeArray 初始树（第一层）
 * @param {*} array 剩余节点数组
 */
function tree(treeArray, array) {
    // 遍历所有节点
    for (let treeNode of treeArray) {
        let id = treeNode.id
        let children = treeNode.children || []
        // 遍历剩余节点
        for (let j = 0; j < array.length; j++) {
            let item = array[j]
            item.children = []
            // 找到父亲，加入父亲节点，并从剩余节点删除
            if (item.parent == id) {
                children.push(item)
                array.splice(j, 1)
                j--
            }
        }
        // 剩余节点不为0时，递归查询
        if (array.length != 0) {
            tree(children, array)
        }
    }
}

module.exports = UserModel