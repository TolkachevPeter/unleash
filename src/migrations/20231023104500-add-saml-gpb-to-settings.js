'use strict';

exports.up = function (db, cb) {
    db.runSql(
        `
    DO $$
    BEGIN
       IF NOT EXISTS (SELECT 1 FROM settings WHERE name = 'saml.gpb') THEN
          INSERT INTO settings(name, content) VALUES ('saml.gpb', '{"entryPoint": "YOUR_ENTRYPOINT_HERE", "path": "/auth/saml/login/callback", "domain": "YOUR_DOMAIN_HERE", "issuer": "unleash", "certificate": "YOUR_CERTIFICATE_HERE"}');
       END IF;
    END
    $$;
  `,
        cb,
    );
};

exports.down = function (db, cb) {
    db.runSql(
        `
        DELETE FROM settings WHERE name = 'saml.gpb'
        `,
        cb,
    );
};
