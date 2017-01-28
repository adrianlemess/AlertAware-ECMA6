var jwt = require('jsonwebtoken');

module.exports = function(application) {

    const config = application.config.config;
    const redis = application.config.redis;

    this.createToken = function(payload, cb) {
        var ttl = config.token.expiration;
        if (payload != null && typeof payload !== 'object') { return cb(new Error('payload is not an Object')) }
        if (ttl != null && typeof ttl !== 'number') { return cb(new Error('ttl is not a valid Number')) }

        /**
         * Token is divided in 3 parts:
         *  - header
         *  - payload (It contains some additional information that we can pass with token e.g. {user: 2, admin: true}. This gets encoded into base64.)
         *  - signature
         *
         * Token is something like xxxxxxxxxxx.yyyy.zzzzzzzzzzzz. Where the x is the encoded header, the y is the encoded payload and
         * the z is the signature. So on front-end we can decode the yyyy part (the payload) if we need.
         */

        var token = jwt.sign(payload.toObject(), config.token.secret, { expiresIn: config.token.expiration });

        if (redis) {
            console.log(redis);
            // stores a token with payload data for a ttl period of time
            redis.setex(token, ttl, JSON.stringify(payload), function(token, err, reply) {
                if (err) {
                    return cb(err);
                }

                if (reply) {
                    cb(null, token);
                } else {
                    cb(new Error('Token not set in Redis'));
                }
            }.bind(null, token));
        } else {
            cb(null, token);
        }
    }

    /**
     * Expires a token by deleting the entry in redis.
     *
     * @method expireToken
     * @param {Object}   headers The request headers
     * @param {Function} cb      Callback function
     * @returns {Function} callback function `callback(null, true)` if successfully deleted
     */
    this.expireToken = function(headers, cb) {
        try {
            var token = this.extractTokenFromHeader(headers);
            if (token == null) { return cb(new Error('Token is null')); }

            if (redis) {
                // delete token from redis
                redis.del(token, function(err, reply) {
                    if (err) {
                        return cb(err);
                    }

                    if (!reply) {
                        return cb(new Error('Não autorizado'));
                    }

                    return cb(null, true);
                });
            } else {
                cb(null, true);
            }
        } catch (err) {
            return cb(err);
        }
    }


    /**
     * Verify if token is valid.
     *
     * @method verifyToken
     * @param {Object}   headers The request headers
     * @param {Function} cb      Callback function
     * @returns {Function} callback function `callback(null, JSON.parse(userData))` if token exist
     */
    this.verifyToken = function(headers, cb) {
        try {
            var token = this.extractTokenFromHeader(headers);

            if (token == null) { return cb(new Error('Token is null')); }

            if (redis) {
                // gets the associated data of the token
                redis.get(token, function(err, userData) {
                    if (err) { return cb(err); }

                    if (!userData) { return cb(new Error('Token not found')); }

                    return cb(null, JSON.parse(userData));
                });
            } else {
                cb(null, true);
            }
        } catch (err) {
            return cb(err);
        }
    }

    this.extractTokenFromHeader = function(headers) {
        if (headers == null) throw new Error('Header is null');
        if (headers.authorization == null) throw new Error('Authorization header is null');

        var authorization = headers.authorization;
        var authArr = authorization.split(' ');
        if (authArr.length !== 2) throw new Error('Authorization header value is not of length 2');

        // retrieve token
        var token = authArr[1];

        // verify token
        try {
            jwt.verify(token, config.token.secret);
        } catch (err) {
            throw new Error('The token is not valid');
        }

        return token;
    }

    return this;
};