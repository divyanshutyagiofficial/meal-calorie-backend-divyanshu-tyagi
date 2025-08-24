export interface RateLimitConfig {
  windowMs: number
  max: number
  standardHeaders: boolean
  legacyHeaders: boolean
  skipSuccessfulRequests: boolean
  skipFailedRequests: boolean
  message: {
    error: string
  }
}

export interface RateLimitConfigs {
  global: RateLimitConfig
  auth: RateLimitConfig
  calories: RateLimitConfig
}

const baseConfig: Omit<RateLimitConfig, 'max'> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: {
    error: "Too many requests from this IP, please try again later",
  },
}

// Environment-based rate limiting
const getEnvironmentLimits = () => {
  const env = process.env.NODE_ENV || 'development'
  
  switch (env) {
    case 'test':
    case 'testing':
      return {
        global: 10000,
        auth: 10000,
        calories: 10000,
      }
    
    case 'development':
      return {
        global: 1000,
        auth: 100,
        calories: 200,
      }
    
    case 'production':
    default:
      return {
        global: 100,
        auth: 15,
        calories: 50,
      }
  }
}

const limits = getEnvironmentLimits()

export const rateLimitConfig: RateLimitConfigs = {
  global: {
    ...baseConfig,
    max: limits.global,
    message: {
      error: "Too many requests from this IP, please try again later",
    },
  },
  
  auth: {
    ...baseConfig,
    max: limits.auth,
    windowMs: 15 * 60 * 1000, // 15 minutes for auth
    message: {
      error: "Too many authentication requests from this IP, please try again after 15 minutes",
    },
  },
  
  calories: {
    ...baseConfig,
    max: limits.calories,
    windowMs: 10 * 60 * 1000, // 10 minutes for calories
    message: {
      error: "Too many calorie requests from this IP, please try again later",
    },
  },
}

// Console logging for debugging
if (process.env.NODE_ENV !== 'production') {
  console.log(`🛡️  Rate Limiting Config (${process.env.NODE_ENV || 'development'}):`)
  console.log(`   Global: ${limits.global} requests per 15min`)
  console.log(`   Auth: ${limits.auth} requests per 15min`)
  console.log(`   Calories: ${limits.calories} requests per 10min`)
}
