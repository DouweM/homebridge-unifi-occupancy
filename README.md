<p align="center">
<a href="[v](https://github.com/DouweM/homebridge-unifi-occupancy)"><img src="logo.png" width="532"></a>
</p>

<span align="center">

# Homebridge + UniFi = Occupancy

[Homebridge](https://homebridge.io) plugin that adds HomeKit occupancy sensors for selected<br>
devices (and people) on your [UniFi](https://www.ui.com/wi-fi) network to the iOS Home app:<br>
**quickly see who's where and automate accordingly**

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Version](https://img.shields.io/npm/v/homebridge-unifi-occupancy?color=green)](https://www.npmjs.com/package/homebridge-unifi-occupancy)
[![Downloads](https://img.shields.io/npm/dt/homebridge-unifi-occupancy)](https://www.npmjs.com/package/homebridge-unifi-occupancy)

</span>

---

By default, every smartphone gets an occupancy sensor for each access point (room/floor/area).

Access points can be mapped to rooms in Settings.
Note that the accessories still need to be manually assigned to the corresponding room in the Home app, which will then automatically hide the room name prefix in the sensor name.

By default, smartphones show up using their owner's name, which is derived from the device (host)name or the alias configured in the UniFi Network UI.
For example, `Douwe's iPhone` (English), `iPhone de Douwe` (Spanish), and `iPhone van Douwe` (Dutch) all show up as `Douwe`.

Other device types to create sensors for can be enabled in Settings.
Device types are determined using the device fingerprint in the UniFi Network UI, either detected automatically or assigned manually.

In addition to sensors for whether a specific device is in a specific room, sensors can be created for whether a specific device is in any room (with the special name `Anywhere`), whether any device of a specific type is in a specific room, or whether any device of a specific type is in any room.

PS. To see the smartphones on your network in your macOS menu bar as well, check out [XBar + UniFi = Who's Home?](https://github.com/DouweM/xbar-whos-home-unifi).

### Web Server

This plugin can expose an API to allow other services on your network to learn what devices (and people) are connected. Currently, the only endpoint is `http://localhost:<port>/clients`.

The Web Server can be enabled in Settings.
You can also assign an avatar (using a Gravatar email or image URL) to each device owner. The avatar is not shown in the Home app, but its URL is exposed in the API for use by other services.

<details>
<summary>Example JSON</summary>

```json
[
  {
    "display_name": "Douwe",
    "type": "smartphone",
    "room": "Living",
    "image_url": "https://s.gravatar.com/avatar/2053c25524bfc5fe833861f628896f87",
    "owner": "Douwe",
    "name": "Douwe’s iPhone",
    "hostname": "",
    "mac": "...",
    "ip": "192.168.1.214",
    "connected": true,
    "wired": false,
    "wifi_ssid": "...",
    "room_mac": "...",
    "fingerprint": {
      "dev_type_id": "44",
      "family_id": "9",
      "name": "Apple iPhone 14 Pro",
      "os_class_id": "15",
      "os_name_id": "24",
      "vendor_id": "320",
      "id": 4841,
      "image_url": "https://static.ubnt.com/fingerprint/0/4841_101x101.png",
      "family": "Smartphone",
      "type": "Handheld",
      "type_id": "44",
      "vendor": "Apple, Inc.",
      "os_class": "Apple iOS",
      "os_name": "Apple iOS"
    },
    "avatar_url": "https://s.gravatar.com/avatar/2053c25524bfc5fe833861f628896f87",
    "guest": false,
    "show_as_owner": true,
    "raw": {...} # Raw client info from UniFi API
  }
]
```
</details>

## Screenshot

<table>
  <thead>
    <tr>
      <td>Default</td>
      <td>Customized</td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Smartphones show as their owner</td>
      <td>Include smart watches, laptops, tablets, and "Anywhere" sensors</td>
    </tr>
    <tr>
      <td valign="top">
        <img src="screenshot.png" width="589">
      </td>
      <td>
        <img src="screenshot2.png" width="589">
      </td>
    </tr>
  </tbody>
</table>

## Installation

The easiest way to install and configure this plugin is via [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x).

Alternatively, add `homebridge-unifi-occupancy` to your Homebridge `package.json` and add the following to `config.json`:

```json
{
  "platforms": [
    {
      "platform": "UnifiOccupancy",
      "unifi": {
          "controller": "https://192.168.1.1",
          "username": "<username>",
          "password": "<password>",
          "site": "default",
          "secure": false,
          "unifios": true
      },
      "interval": 180,
      "accessPointAliases": [
          {
              "accessPoint": "Dream Machine",
              "alias": "Living"
          },
          {
              "accessPoint": "Office nanoHD",
              "alias": "Office"
          },
          {
              "accessPoint": "Bedroom nanoHD",
              "alias": "Bedroom"
          },
          {
              "accessPoint": "Roof FlexHD",
              "alias": "Rooftop"
          }
      ],
      "showAsOwner": "smartphone",
      "deviceType": {
        "smartphone": {
          "roomAccessory": true,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": false
        },
        "smart_watch": {
          "roomAccessory": false,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": false
        },
        "laptop": {
          "roomAccessory": false,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": false
        },
        "tablet": {
          "roomAccessory": false,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": false
        },
        "ereader": {
          "roomAccessory": false,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": false
        },
        "game_console": {
          "roomAccessory": false,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": false
        },
        "handheld": {
          "roomAccessory": false,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": true
        },
        "other": {
          "roomAccessory": false,
          "homeAccessory": false,
          "lazy": true
        },
        "wired": {
          "roomAccessory": false
        },
      },
      "clientRules": [
        {
          "label": "Douwe's devices",
          "namePatterns": [
            "/^Douwe/",
            "Nintendo Switch"
          ],
          "roomAccessory": true,
          "homeAccessory": false,
          "roomCatchallAccessory": false,
          "homeCatchallAccessory": false,
          "lazy": true
        }
      ],
      "server": {
        "enabled": false,
        "port": 8582,
        "username": "",
        "password": "",
      },
      "avatars": [
        {
          "owner": "Douwe",
          "identifier": "hi@douwe.me"
        },
        {
          "owner": "Gaby",
          "identifier": "https://em-content.zobj.net/thumbs/240/apple/354/woman_medium-skin-tone_1f469-1f3fd_1f3fd.png"
        }
      ]
    }
  ]
}
```
