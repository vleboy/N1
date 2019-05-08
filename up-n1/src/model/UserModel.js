const _ = require('lodash')
const BaseModel = require('./BaseModel')
const StatusEnum = require('../lib/UserConsts').StatusEnum
const BizErr = require('../lib/Codes').BizErr
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const Model = require('../lib/Model').Model
const config = require('config')

class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: Model.StringValue,
            userId: Model.StringValue
        }
    }
    //根据suffix获取线路商信息
    async queryBySuffix(inparam) {
        let res = await this.query({
            KeyConditionExpression: '#role=:role',
            FilterExpression: 'suffix = :suffix',
            ProjectionExpression: 'userId',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Manager,
                ':suffix': inparam.suffix
            }
        })
        return res.Items[0]
    }

    //查询平台所有用户
    async queryPlatId(inparam) {
        let queryParms = {
            KeyConditionExpression: '#role=:role',
            ProjectionExpression: 'userId',
            ExpressionAttributeNames: {
                '#role': 'role'
            }
        }
        if (inparam.isTest == 0) {              //只查正式
            queryParms.FilterExpression = 'isTest <> :isTest'
            queryParms.ExpressionAttributeValues = {
                ':isTest': 1,
                ':role': RoleCodeEnum.Merchant
            }
        } else if (inparam.isTest == 1) {       //只查测试
            queryParms.FilterExpression = 'isTest = :isTest'
            queryParms.ExpressionAttributeValues = {
                ':isTest': 1,
                ':role': RoleCodeEnum.Merchant
            }
        } else {                        //全查
            queryParms.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Merchant
            }
        }
        let res = await this.query(queryParms)
        return res.Items
    }
    //查询根据线路商id获取下级商户
    async queryMerchantId(inparam) {
        if (inparam.isAll) {  //查下级所有商户
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
                    ':role': RoleCodeEnum.Merchant
                }
            } else if (inparam.isTest == 1) {       //只查测试
                queryParms.FilterExpression = 'contains(#levelIndex,:levelIndex) AND isTest = :isTest'
                queryParms.ExpressionAttributeValues = {
                    ':levelIndex': inparam.parentId,
                    ':isTest': 1,
                    ':role': RoleCodeEnum.Merchant
                }
            } else {                        //全查
                queryParms.FilterExpression = 'contains(#levelIndex,:levelIndex)'
                queryParms.ExpressionAttributeValues = {
                    ':levelIndex': inparam.parentId,
                    ':role': RoleCodeEnum.Merchant
                }
            }
            let res = await this.query(queryParms)
            return res.Items
        } else { //查询直属商户
            let queryParms = {
                IndexName: 'RoleParentIndex',
                ProjectionExpression: 'userId',
                KeyConditionExpression: '#role=:role AND #parent=:parent',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#parent': 'parent'
                }
            }
            if (inparam.isTest == 0) {              //只查正式
                queryParms.FilterExpression = 'isTest <> :isTest'
                queryParms.ExpressionAttributeValues = {
                    ':parent': inparam.parentId,
                    ':isTest': 1,
                    ':role': RoleCodeEnum.Merchant
                }
            } else if (inparam.isTest == 1) {       //只查测试
                queryParms.FilterExpression = 'isTest = :isTest'
                queryParms.ExpressionAttributeValues = {
                    ':parent': inparam.parentId,
                    ':isTest': 1,
                    ':role': RoleCodeEnum.Merchant
                }
            } else {                        //全查
                queryParms.ExpressionAttributeValues = {
                    ':parent': inparam.parentId,
                    ':role': RoleCodeEnum.Merchant
                }
            }
            let res = await this.query(queryParms)
            return res.Items
        }

    }

    /**
     * 查看可用线路商
     */
    async listAvalibleManagers() {
        const queryRet = await this.query({
            KeyConditionExpression: '#role = :role',
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Manager,
                ':status': StatusEnum.Enable
            }
        })
        // 按照层级排序
        const sortResult = _.sortBy(queryRet.Items, ['level'])
        const viewList = _.map(sortResult, (item) => {
            return {
                value: item.userId,
                label: item.displayName
            }
        })
        return viewList
    }
    /**
     * 查看共享钱包用户 
     */
    async getUsersTranser() {
        const queryRet = await this.query({
            KeyConditionExpression: '#role = :role',
            ProjectionExpression: 'sn,transferURL',
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Merchant,
                ':status': StatusEnum.Enable
            }
        })
        let userSN = []
        for (let item of queryRet.Items) {
            if (item.transferURL) {
                userSN.push(item.sn)
            }
        }
        return userSN
    }
    //根据sn获取用户信息
    async getUserBySN(sn) {
        const queryRet = await this.query({
            KeyConditionExpression: '#role = :role',
            ProjectionExpression: 'displayName,transferMap,userId,levelIndex',
            FilterExpression: 'sn = :sn',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Merchant,
                ':sn': sn
            }
        })
        return queryRet.Items[0]
    }
    //根据displayId获取用户信息
    async getUserByDisplayId(displayId) {
        const queryRet = await this.query({
            IndexName: "merchantIdIndex",
            KeyConditionExpression: 'displayId = :displayId',
            ProjectionExpression: 'userId,levelIndex',
            ExpressionAttributeValues: {
                ':displayId': +displayId
            }
        })
        return queryRet.Items[0]
    }

    /**
     * 检查用户是否重复
     * @param {*} role 
     * @param {*} suffix 
     * @param {*} uname 
     */
    async checkUserBySuffix(role, suffix, uname) {
        let finalRet = { Items: [] }
        // 平台管理员
        if (role === RoleCodeEnum.PlatformAdmin) {
            finalRet = await this.query({
                ProjectionExpression: 'userId,#role,#suffix,#username,uname,#parent,parentName,parentDisplayName,parentRole,displayName,displayId,#level,msn,apiKey,sn,gameList,#rate,password,subRole',
                IndexName: 'RoleUsernameIndex',
                KeyConditionExpression: '#role = :role AND #username = :username',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#suffix': 'suffix',
                    '#username': 'username',
                    '#parent': 'parent',
                    '#rate': 'rate',
                    '#level': 'level'
                },
                ExpressionAttributeValues: {
                    ':role': role,
                    ':username': `${suffix}_${uname}`
                }
            })
        }
        // 检查角色+帐号
        else if (uname && uname != 'NULL!') {
            finalRet = await this.query({
                IndexName: 'RoleUsernameIndex',
                KeyConditionExpression: '#role = :role AND #username = :username',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#username': 'username'
                },
                ExpressionAttributeValues: {
                    ':role': role,
                    ':username': `${suffix}_${uname}`
                }
            })
        }
        // 检查角色+前缀
        else {
            finalRet = await this.query({
                KeyConditionExpression: '#role = :role',
                FilterExpression: '#suffix = :suffix',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#suffix': 'suffix'
                },
                ExpressionAttributeValues: {
                    ':role': role,
                    ':suffix': suffix
                }
            })
        }
        if (finalRet.Items.length > 0) {
            return false
        } else {
            return true
        }
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
     * 检查昵称是否重复
     * @param {*} role 
     * @param {*} displayName 
     */
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
     * 查询用户
     * @param {*} userId 
     * @param {*} role
     * @param {*} options 
     */
    async getUser(userId, role, options) {
        let query = {
            KeyConditionExpression: '#role = :role AND userId = :userId',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': role,
                ':userId': userId
            }
        }
        if (options) {
            query.ProjectionExpression = options.ProjectionExpression
            query.ExpressionAttributeNames = options.ExpressionAttributeNames
        }
        const queryRet = await this.query(query)
        if (queryRet.Items.length - 1 != 0) {
            throw BizErr.UserNotFoundErr()
        }
        const User = queryRet.Items[0]
        return User
    }

    /**
     * 通过userId查询用户
     * @param {*} userId 
     * @param {*} options 
     */
    async queryUserById(userId, options) {
        let query = {
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        }
        if (options) {
            query.ProjectionExpression = options.ProjectionExpression
            query.ExpressionAttributeNames = options.ExpressionAttributeNames
        }
        const querySet = await this.query(query)
        if (querySet.Items.length - 1 != 0) {
            throw BizErr.UserNotFoundErr()
        }
        return querySet.Items[0]
    }
    /**
     * 通过父级id获取下级displayId
     */
    async getDisplayIdsByParent(parent) {
        let res = await this.scan({
            FilterExpression: 'contains(#levelIndex,:levelIndex) AND #role <> :role',
            ProjectionExpression: 'displayId',
            ExpressionAttributeNames: {
                '#levelIndex': 'levelIndex',
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':levelIndex': parent,
                ':role': RoleCodeEnum.Manager
            }
        })
        return res.Items
    }

    /**
     * 根据sn或username查找用户
     * @param {*} role
     * @param {*} suffix
     * @param {*} uname 
     * @param {*} sn
     */
    async queryUserByNameOrSn(role, suffix, uname, sn) {
        // 商户
        if (sn) {
            return await this.query({
                ProjectionExpression: 'userId,#role,#suffix,#username,uname,#parent,parentName,parentDisplayName,parentRole,displayName,displayId,#level,msn,apiKey,sn,gameList,#rate,password,subRole',
                KeyConditionExpression: '#role = :role',
                FilterExpression: 'sn = :sn AND uname = :uname',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#suffix': 'suffix',
                    '#username': 'username',
                    '#parent': 'parent',
                    '#rate': 'rate',
                    '#level': 'level'
                },
                ExpressionAttributeValues: {
                    ':role': role,
                    ':sn': sn,
                    ':uname': uname
                }
            })
        }
        // 管理员，线路商
        else {
            return await this.query({
                ProjectionExpression: 'userId,#role,#suffix,#username,uname,#parent,parentName,parentDisplayName,parentRole,displayName,displayId,#level,msn,apiKey,sn,gameList,#rate,password,subRole',
                IndexName: 'RoleUsernameIndex',
                KeyConditionExpression: '#role = :role AND #username = :username',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#suffix': 'suffix',
                    '#username': 'username',
                    '#parent': 'parent',
                    '#rate': 'rate',
                    '#level': 'level'
                },
                ExpressionAttributeValues: {
                    ':role': role,
                    ':username': `${suffix}_${uname}`
                }
            })
        }
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
        let query10 = {
            IndexName: 'RoleParentIndex',
            ProjectionExpression: ProjectionExpression,
            KeyConditionExpression: '#role=:role AND #parent=:parent',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#parent': 'parent',
                '#level': 'level'
            }
        }
        let query100 = {
            IndexName: 'RoleParentIndex',
            ProjectionExpression: ProjectionExpression,
            KeyConditionExpression: '#role=:role AND #parent=:parent',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#parent': 'parent',
                '#level': 'level'
            }
        }
        if (inparam.isTest == 0) {              //只查正式商户的
            query10.FilterExpression = 'isTest<>:isTest'
            query10.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Manager,
                ':parent': inparam.parent,
                ':isTest': 1
            }
            query100.FilterExpression = 'isTest<>:isTest'
            query100.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Merchant,
                ':parent': inparam.parent,
                ':isTest': 1
            }
        } else if (inparam.isTest == 1) {       //只查测试商户的
            query10.FilterExpression = 'isTest=:isTest'
            query10.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Manager,
                ':parent': inparam.parent,
                ':isTest': inparam.isTest
            }
            query100.FilterExpression = 'isTest=:isTest'
            query100.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Merchant,
                ':parent': inparam.parent,
                ':isTest': inparam.isTest
            }
        } else {                                //全查平台商户
            query10.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Manager,
                ':parent': inparam.parent
            }
            query100.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Merchant,
                ':parent': inparam.parent
            }
        }
        // 条件搜索
        let conditions10 = inparam.query
        let conditions100 = inparam.query
        if (inparam.sn) {
            conditions10 = { suffix: { $like: inparam.sn } }
            conditions100 = { sn: { $like: inparam.sn } }
        }
        let p1 = this.bindFilterQuery(query10, conditions10, false)
        let p2 = this.bindFilterQuery(query100, conditions100, false)
        let resArr = await Promise.all([p1, p2])
        let queryRet10 = resArr[0]
        let queryRet100 = resArr[1]
        let finalRes = queryRet10.Items.concat(queryRet100.Items)
        // 排序输出
        let sortResult = _.sortBy(finalRes, ['role', 'sn', 'suffix'])
        if (inparam.sort == "desc") { sortResult = sortResult.reverse() }
        return sortResult
    }


    /**
     * 查询玩家统计
     */
    async queryChildPlayer(inparam) {
        let query = {
            TableName: config.env.TABLE_NAMES.TABLE_USER,
            ProjectionExpression: 'userName,nickname,#parent,parentName,merchantName,msn,createdAt,gameList,balance,#state,joinTime',
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
            ProjectionExpression: 'userId,#role,#status,gameList,companyList,sn',
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

    /**
     * 查看下级用户
     * @param {*} userId 
     * @param {*} roleCode 
     */
    async listChildUsers(inparam) {
        let query = {
            ProjectionExpression: 'userId,username,uname,#role,#status,displayName,sn,suffix,parent,parentName,parentDisplayName,parentRole,createdAt,remark',
            IndexName: 'RoleParentIndex',
            KeyConditionExpression: '#role = :role and parent = :parent',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':parent': inparam.userId,
                ':role': inparam.role
            }
        }
        const queryRet = await this.query(query)
        return queryRet.Items
    }

    //查询指定父级的商户数量
    async count(parent) {
        let res = await this.query({
            IndexName: 'RoleParentIndex',
            KeyConditionExpression: '#role = :role AND parent = :parent',
            ProjectionExpression: 'userId',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Merchant,
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