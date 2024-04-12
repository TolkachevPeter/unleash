'use strict';

exports.up = function (db, cb) {
    db.runSql(
        `
            ALTER TABLE features
            ADD COLUMN IF NOT EXISTS last_enabled_at TIMESTAMP WITH TIME ZONE;
        `,
        cb,
    );
};

exports.down = function (db, cb) {
    db.runSql(
        `
            ALTER TABLE features
            DROP COLUMN IF EXISTS last_enabled_at;
        `,
        cb,
    );
};
