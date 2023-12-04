'use strict';

exports.up = function (db, cb) {
    db.runSql(
        `
            ALTER TABLE feature_environments
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE;
        `,
        cb
    );
};

exports.down = function (db, cb) {
    db.runSql(
        `
            ALTER TABLE feature_environments
            DROP COLUMN IF EXISTS last_updated;
        `,
        cb
    );
};
