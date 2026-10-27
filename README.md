# Asterisk Switchboard Card for Home Assistant

A clean, responsive Lovelace switchboard for the [TECH7Fox Asterisk integration](https://github.com/TECH7Fox/asterisk-hass-integration).

## Features

- AMI connection status from `binary_sensor.ami_connected`
- Automatically discovers extension registration entities and matches state sensors
- Supports simple and prefixed Asterisk entity naming patterns
- Live counts for available, ringing, in-use, and unavailable extensions
- Responsive extension tiles, friendly labels, and no extra frontend dependencies

## Install using HACS

1. Open **HACS → Frontend** (or **HACS → Dashboard** depending on your HACS version).
2. Open the three-dot menu and choose **Custom repositories**.
3. Add `https://github.com/anazario93/ha_asterisk_switchboard_card` and choose **Dashboard** (or **Lovelace**) as the category.
4. Add the repository and download **Asterisk Switchboard Card**.
5. Refresh your browser after installation.
6. Add a Manual card using the YAML below.

## Manual installation

Copy `asterisk-switchboard-card.js` to `/config/www/asterisk-switchboard-card.js`, then add resource `/local/asterisk-switchboard-card.js` with type **JavaScript Module**.

## Configuration

```yaml
type: custom:asterisk-switchboard-card
title: Asterisk Switchboard
ami_entity: binary_sensor.ami_connected
columns: 3
show_unregistered: true
extensions:
  "202": Reception
  "203": Office
exclude_extensions:
  - "201"
  - "204"
```

Options: `title` sets the heading, `ami_entity` sets the AMI connectivity entity, `columns` controls desktop columns (1–6), `show_unregistered` hides offline extensions when false, `extensions` maps extension numbers or entity bases to custom display labels, and `exclude_extensions` is a list of extension numbers or entity bases to omit from the card. Extension labels fall back to `Extension <number>` when not configured. For example, `extensions: { "202": Reception }` changes extension 202’s label, while `exclude_extensions: ["201", "pjsip_204_204"]` hides extensions 201 and 204.

The card displays status and opens an entity's More Info panel. It does not initiate, transfer, or hang up calls.
