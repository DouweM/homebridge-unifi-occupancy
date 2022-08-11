# Homebridge + UniFi = Occupancy

Homebridge plugin that creates occupancy sensors for all smartphones on a [UniFi](https://www.ubnt.com/download/unifi) network.

To enable presence tracking across rooms/areas/floors, every phone gets a dedicated sensor per WiFi access point, named `<Name> @ <AP>`.

AP aliases can be configured to map an AP name or MAC address to a room name, or to merge different APs into one sensor (per phone).

Generic phone names can be overridden in the UniFi Network UI.
Where possible, generic prefixes and suffixes are filtered out to derive the owner's name, e.g. "Douwe's iPhone" becomes "Douwe".

## Configuration

The easiest way to install and configure this plugin is via [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x).

Alternatively, add `homebridge-unifi-occupancy` to your Homebridge `package.json` and add the following

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
      "interval": 1800,
      "accessPointAliases": [
          {
              "accessPoint": "Dream Machine",
              "alias": "Living Room"
          },
          {
              "accessPoint": "Office nanoHD",
              "alias": "Office"
          },
          {
              "accessPoint": "Roof FlexHD",
              "alias": "Rooftop"
          }
      ]
    }
  ]
}
```
