-- 135: Default Council titles for Imperium Noctis.
-- Preserve office codes, appointments, ballots, quorum, ratification and authored charters.
USE eclipse_order;

UPDATE order_council_offices SET title='Imperatrix'
 WHERE code='domina' AND title='Domina';
UPDATE order_council_offices SET title='Magister Militum'
 WHERE code='operations' AND title='Chief of Operations';
UPDATE order_council_offices SET title='Quaestor Aerarii'
 WHERE code='commerce' AND title='Master of Commerce';
UPDATE order_council_offices SET title='Legatus Diplomaticus'
 WHERE code='faction' AND title='Faction Envoy';
UPDATE order_council_offices SET title='Praefectus Civium'
 WHERE code='internal' AND title='Prefect of Internal Affairs';

-- Only an untouched default charter is rewritten. User-edited charters remain authoritative.
UPDATE order_governance_charter
 SET title='Imperium Noctis Charter',
 charter_text='Under Imperatrix Rosa, Imperium Noctis is governed by its appointed chamber. The Consilium Imperiale serves until the Senate is convened. Once established, the Senate assumes the Council''s governing authority with fifteen senatorial seats and three Heads. The Imperatrix may suspend the Senate and restore the Council. The Charter governs its proceedings and the authority of its officers. In-character rulings do not override OOC consent, security, moderation, or account permissions.'
 WHERE id=1 AND revision=1 AND updated_by IS NULL
 AND title='Eclipse Order Charter'
 AND (charter_text LIKE 'Under the Domina, the Eclipse Order is governed by its appointed chamber.%'
   OR charter_text LIKE 'The Domina presides over five permanent Council offices.%');

INSERT INTO schema_migrations(version) VALUES('135_imperial_council_titles')
ON DUPLICATE KEY UPDATE version=VALUES(version);
