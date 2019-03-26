// import { GeneratePolicyDocument } from './lib/all'
// import jwt from 'jsonwebtoken'
// // ==================== 以下为内部方法 ====================

// // TOKEN验证
// const jwtverify = async (e, c, cb) => {
//   try {
//     const token = e.authorizationToken.split(' ')
//     if (token[0] !== 'Bearer') {
//       return c.fail('授权类型错误')
//     }
//     const userInfo = await jwt.verify(token[1], process.env.TOKEN_SECRET)
//     return c.succeed(GeneratePolicyDocument(userInfo.userId, 'Allow', e.methodArn, userInfo))
//   } catch (error) {
//     let message = error.message
//     switch (message) {
//       case 'jwt expired':
//         return c.succeed(GeneratePolicyDocument(-1, 'Allow', e.methodArn, {}))
//         break;
//       default:
//         console.error('监控错误调试：')
//         console.error(error)
//         return c.fail('非法访问')
//     }
//   }
// }

// export {
//   jwtverify                    // 用于进行token验证的方法
// }
