'use strict';

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;

const Keybindings = imports.service.ui.keybindings;


function section_separators(row, before) {
    if (before) {
        row.set_header(new Gtk.Separator({ visible: true }));
    }
};


function switcher_separators(row, before) {
    if (before && (before.type === undefined || row.type !== before.type)) {
        row.set_header(new Gtk.Separator({ visible: true }));
    }
};


/**
 * A row for a stack sidebar
 */
var DeviceRow = GObject.registerClass({
    GTypeName: 'GSConnectSettingsDeviceRow',
    Properties: {
        'connected': GObject.ParamSpec.boolean(
            'connected',
            'deviceConnected',
            'Whether the device is connected',
            GObject.ParamFlags.READWRITE,
            false
        ),
        'paired': GObject.ParamSpec.boolean(
            'paired',
            'devicePaired',
            'Whether the device is paired',
            GObject.ParamFlags.READWRITE,
            false
        ),
        'symbolic-icon':GObject.ParamSpec.object(
            'symbolic-icon',
            'Symbolic Icon',
            'Icon representing the device type and state',
            GObject.ParamFlags.READWRITE,
            Gio.Icon
        )
    }
}, class GSConnectSettingsDeviceRow extends Gtk.ListBoxRow {

    _init(device) {
        super._init({
            selectable: true,
            visible: true
        });

        this.set_name(device.id);
        this.device = device;

        let grid = new Gtk.Grid({
            orientation: Gtk.Orientation.HORIZONTAL,
            column_spacing: 12,
            margin_left: 8,
            margin_right: 8,
            margin_bottom: 12,
            margin_top: 12,
            visible: true
        });
        this.add(grid);

        let icon = new Gtk.Image({
            pixel_size: 16,
            visible: true
        });
        this.bind_property('symbolic-icon', icon, 'gicon', 2);
        grid.attach(icon, 0, 0, 1, 1);

        let title = new Gtk.Label({
            halign: Gtk.Align.START,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            vexpand: true,
            visible: true
        });
        device.settings.bind('name', title, 'label', 0);
        grid.attach(title, 1, 0, 1, 1);

        // A '>' image for rows that are like submenus
        let go_next = new Gtk.Image({
            icon_name: 'go-next-symbolic',
            pixel_size: 16,
            halign: Gtk.Align.END,
            visible: true
        });
        grid.attach(go_next, 2, 0, 1, 1);

        this.connect('notify::connected', () => this.notify('symbolic-icon'));
        device.bind_property('connected', this, 'connected', 2);
        this.connect('notify::paired', () => this.notify('symbolic-icon'));
        device.bind_property('paired', this, 'paired', 2);
    }

    get symbolic_icon() {
        let name = this.device.symbolic_icon_name;

        if (!this.paired) {
            let rgba = new Gdk.RGBA({ red: 0.95, green: 0, blue: 0, alpha: 0.9 });
            let info = Gtk.IconTheme.get_default().lookup_icon(name, 16, 0);
            return info.load_symbolic(rgba, null, null, null)[0];
        }

        this.get_child().get_child_at(0, 0).opacity = this.connected ? 1 : 0.5;

        return new Gio.ThemedIcon({ name: name });
    }

    get type() {
        return 'device';
    }
});


/**
 * A row for a section of settings
 */
var SectionRow = GObject.registerClass({
    GTypeName: 'GSConnectSectionRow'
}, class SectionRow extends Gtk.ListBoxRow {

    _init(params) {
        super._init({
            activatable: true,
            selectable: false,
            height_request: 56,
            visible: true
        });

        let grid = new Gtk.Grid({
            column_spacing: 12,
            margin_top: 8,
            margin_right: 12,
            margin_bottom: 8,
            margin_left: 12,
            visible: true
        });
        this.add(grid);

        // Row Icon
        this._icon = new Gtk.Image({
            pixel_size: 32
        });
        grid.attach(this._icon, 0, 0, 1, 2);

        // Row Title
        this._title = new Gtk.Label({
            halign: Gtk.Align.START,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            vexpand: true
        });
        grid.attach(this._title, 1, 0, 1, 1);

        // Row Subtitle
        this._subtitle = new Gtk.Label({
            halign: Gtk.Align.START,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            vexpand: true
        });
        this._subtitle.get_style_context().add_class('dim-label');
        grid.attach(this._subtitle, 1, 1, 1, 1);

        Object.assign(this, params);
    }

    get icon() {
        return this._icon.gicon;
    }

    set icon(gicon) {
        this._icon.visible = (gicon);
        this._icon.gicon = gicon;
    }

    get icon_name() {
        return this._icon.icon_name;
    }

    set icon_name(text) {
        this._icon.visible = (text);
        this._icon.icon_name = text;
    }

    get title() {
        return this._title.label;
    }

    set title(text) {
        this._title.visible = (text);
        this._title.label = text;
    }

    get subtitle() {
        return this._subtitle.label;
    }

    set subtitle(text) {
        this._subtitle.visible = (text);
        this._subtitle.label = text;
    }

    get widget() {
        return this._widget;
    }

    set widget(widget) {
        if (this._widget && this._widget instanceof Gtk.Widget) {
            this._widget.destroy();
        }

        this._widget = widget;
        this.get_child().attach(this.widget, 2, 0, 1, 2);
    }
});


var Window = GObject.registerClass({
    GTypeName: 'GSConnectSettingsWindow',
    Template: 'resource:///org/gnome/Shell/Extensions/GSConnect/settings.ui',
    Children: [
        // HeaderBar
        'headerbar', 'headerbar-stack',
        'service-name', 'headerbar-edit', 'headerbar-entry',
        'device-name', 'device-type',
        'prev-button', 'device-menu', 'service-menu',
        // Sidebar
        'stack', 'switcher', 'sidebar',
        'shell-list', 'display-mode',
        'network-list',
        'advanced-list',
        'help', 'help-list'
    ]
}, class Window extends Gtk.ApplicationWindow {

    _init(params) {
        this.connect_template();

        super._init(params);

        this.settings = new Gio.SimpleActionGroup();
        this.insert_action_group('settings', this.settings);

        // Service HeaderBar
        gsconnect.settings.bind(
            'public-name',
            this.service_name,
            'label',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.service_menu.set_menu_model(this.application.app_menu);

        // Sidebar
        this.help.type = 'device';
        this.switcher.set_header_func(this._headerFunc);
        this.switcher.select_row(this.switcher.get_row_at_index(0));

        // Init UI Elements
        this._serviceSettings();

        // Setup devices
        this._serviceDevices = this.application.connect(
            'notify::devices',
            this._onDevicesChanged.bind(this)
        );
        this._onDevicesChanged();
    }

    _headerFunc(row, before) {
        if (before !== null && before.get_name() === 'advanced') {
            row.set_header(new Gtk.Separator({ visible: true }));
        }
    }

    /**
     * HeaderBar Callbacks
     */
    _onPrevious(button, event) {
        //
        this.prev_button.visible = false;
        this.headerbar_stack.visible_child_name = 'headerbar-service';

        // Select the general page
        this.sidebar.visible_child_name = 'switcher';
        this.switcher.get_row_at_index(0).activate();

        // Reset the device menu
        this._setDeviceMenu();
    }

    _onEditServiceName(button, event) {
        this.headerbar_entry.text = this.application.name;
        this.headerbar_stack.visible_child_name = 'headerbar-entry';
    }

    _onEscServiceName(entry, event) {
        if (event.get_event_type() === Gdk.EventType.KEY_PRESS &&
            event.get_keyval()[1] === Gdk.KEY_Escape) {
            this.headerbar_stack.visible_child_name = 'headerbar-service';
        }

        return false;
    }

    _onUnfocusServiceName(entry, event) {
        this.headerbar_stack.visible_child_name = 'headerbar-service';

        return false;
    }

    _onSetServiceName(button, event) {
        this.service_name.label = this.headerbar_entry.text;
        this.headerbar_stack.visible_child_name = 'headerbar-service';
    }

    /**
     * Context Switcher
     */
    _setDeviceMenu(panel=null) {
        this.device_menu.insert_action_group('device', null);
        this.device_menu.insert_action_group('status', null);
        this.device_menu.set_menu_model(null);

        if (panel) {
            this.device_menu.insert_action_group('device', panel.device);
            this.device_menu.insert_action_group('status', panel.actions);
            this.device_menu.set_menu_model(panel.menu);
        }
    }

    async _onSwitcherRowSelected(box, row) {
        row = row || this.switcher.get_row_at_index(0);
        let name = row.get_name();

        this.stack.visible_child_name = name;

        if (this.sidebar.get_child_by_name(name)) {
            let panel = this.stack.visible_child;
            let device = this.stack.visible_child.device;
            this._setDeviceMenu(panel);

            // Transition the headerbar & sidebar
            this.prev_button.visible = true;
            this.device_name.label = device.name;
            this.device_type.label = device.display_type;
            this.headerbar_stack.visible_child_name = 'headerbar-device';

            this.sidebar.visible_child_name = name;
        }
    }

    /**
     * UI Setup and template connecting
     */
    _serviceSettings() {
        this.settings.add_action(gsconnect.settings.create_action('show-offline'));
        this.settings.add_action(gsconnect.settings.create_action('show-unpaired'));
        this.settings.add_action(gsconnect.settings.create_action('show-battery'));
        this.settings.add_action(gsconnect.settings.create_action('debug'));

        this.shell_list.set_header_func(section_separators);
        this.network_list.set_header_func(section_separators);
        this.advanced_list.set_header_func(section_separators);

        this._setDisplayMode();
    }

    _setDisplayMode(box, row) {
        let state = gsconnect.settings.get_boolean('show-indicators');

        if (row) {
            state = !state;
            gsconnect.settings.set_boolean('show-indicators', state);
        }

        this.display_mode.label = state ? _('Panel') : _('User Menu');
    }

    async _onDevicesChanged() {
        for (let id of this.application.devices) {
            if (!this.stack.get_child_by_name(id)) {
                await this.addDevice(id);
            }
        }

        this.stack.foreach(child => {
            if (child.row) {
                let id = child.row.get_name();

                if (!this.application.devices.includes(id)) {
                    let panel = this.stack.get_child_by_name(id);
                    panel._destroy();
                    panel.destroy();
                }
            }
        });

        this.help.visible = !this.application.devices.length;
    }

    async addDevice(id) {
        let device = this.application._devices.get(id);

        // Create a new device widget
        let panel = new Device(device);

        // Add device to switcher, and panel stack
        this.stack.add_titled(panel, id, device.name);
        this.sidebar.add_named(panel.switcher, id);
        this.switcher.add(panel.row);
    }
});


var Device = GObject.registerClass({
    GTypeName: 'GSConnectSettingsDevice',
    Template: 'resource:///org/gnome/Shell/Extensions/GSConnect/device.ui',
    Children: [
        'switcher',
        // Sharing
        'sharing-list',
        'clipboard', 'mousepad', 'mpris', 'systemvolume',
        // RunCommand
        'runcommand', 'command-list',
        'command-toolbar', 'command-add', 'command-remove', 'command-edit',
        'command-editor', 'command-name', 'command-line',
        // Notifications
        'notification', 'notification-page',
        'share-notifications', 'notification-apps',
        // Telephony
        'telephony',
        'telephony-list', 'handle-sms', 'handle-calls',
        'calls-list',
        'ringing-button', 'talking-button',
        // Errata
        'errata', 'errata-page', 'error-list',
        // Events
        'events-list',
        // Shortcuts
        'shortcuts-actions', 'shortcuts-actions-title', 'shortcuts-actions-list',
        'shortcuts-commands', 'shortcuts-commands-title', 'shortcuts-commands-list',
        // Advanced
        'plugin-list',
        'danger-list', 'device-delete-button',
    ]
}, class Device extends Gtk.Stack {

    _init(device) {
        this.connect_template();

        super._init();

        this.service = Gio.Application.get_default();
        this.device = device;

        // Connect Actions
        this.actions = new Gio.SimpleActionGroup();
        this.insert_action_group('status', this.actions);

        let status_bluetooth = new Gio.SimpleAction({
            name: 'connect-bluetooth',
            parameter_type: null
        });
        status_bluetooth.connect('activate', this._onActivateBluetooth.bind(this));
        this.actions.add_action(status_bluetooth);

        let status_lan = new Gio.SimpleAction({
            name: 'connect-tcp',
            parameter_type: null
        });
        status_lan.connect('activate', this._onActivateLan.bind(this));
        this.actions.add_action(status_lan);

        // Pair Actions
        let status_pair = new Gio.SimpleAction({
            name: 'pair',
            parameter_type: null
        });
        status_pair.connect('activate', this.device.pair.bind(this.device));
        this.device.bind_property('paired', status_pair, 'enabled', 6);
        this.actions.add_action(status_pair);

        let status_unpair = new Gio.SimpleAction({
            name: 'unpair',
            parameter_type: null
        });
        status_unpair.connect('activate', this.device.unpair.bind(this.device));
        this.device.bind_property('paired', status_unpair, 'enabled', 2);
        this.actions.add_action(status_unpair);

        // GMenu
        let builder = Gtk.Builder.new_from_resource(gsconnect.app_path + '/gtk/menus.ui');
        this.menu = builder.get_object('device-status');
        this.menu.prepend_section(null, this.device.menu);

        // Sidebar Row
        this.row = new DeviceRow(this.device);

        this.insert_action_group('device', this.device);

        // Settings Pages
        this._sharingSettings();
        this._runcommandSettings();
        this._notificationSettings();
        this._telephonySettings();
        // --------------------------
        this._keybindingSettings();
        this._pluginSettings();

        // Separate plugins and other settings
        this.switcher.set_header_func((row, before) => {
            if (row.get_name() === 'shortcuts') {
                row.set_header(new Gtk.Separator({ visible: true }));
            }
        });

        // Device Changes
        this._actionAddedId = this.device.connect(
            'action-added',
            this._onActionsChanged.bind(this)
        );
        this._actionRemovedId = this.device.connect(
            'action-removed',
            this._onActionsChanged.bind(this)
        );
        this._actionEnabledId = this.device.connect(
            'action-enabled-changed',
            this._onActionsChanged.bind(this)
        );

        // Connected/Paired
        this._bluetoothHostChangedId = this.device.settings.connect(
            'changed::bluetooth-host',
            this._onBluetoothHostChanged.bind(this)
        );
        this._onBluetoothHostChanged(this.device.settings);

        this._tcpHostChangedId = this.device.settings.connect(
            'changed::tcp-host',
            this._onTcpHostChanged.bind(this)
        );
        this._onTcpHostChanged(this.device.settings);

        this._connectedId = this.device.connect(
            'notify::connected',
            this._onConnected.bind(this)
        );
        this._onConnected(this.device);

        // Errors/Warnings
        this.device.connect('notify::errors', this._errataPage.bind(this));
        this._errataPage();

        // Hide elements for any disabled plugins
        for (let name of this.device.supported_plugins) {
            if (this.hasOwnProperty(name)) {
                this[name].visible = this.device.get_plugin_allowed(name);
            }
        }
    }

    // FIXME: bogus
    _errataPage() {
        this.error_list.foreach(row => {
            row.widget.disconnect(row._loadPluginId);
            row.destroy()
        });

        for (let [name, error] of this.device.errors) {
            let row = new SectionRow({
                title: name,
                subtitle: error.message,
                widget: new Gtk.Button({
                    image: new Gtk.Image({
                        icon_name: 'view-refresh-symbolic',
                        pixel_size: 16,
                        visible: true
                    }),
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.CENTER,
                    vexpand: true,
                    visible: true
                }),
                activatable: false,
                selectable: false
            });
            row._subtitle.tooltip_text = error.message;
            row._subtitle.ellipsize = Pango.EllipsizeMode.MIDDLE;

            row.widget.get_style_context().add_class('circular');
            row.widget.get_style_context().add_class('flat');
            row._loadPluginId = row.widget.connect(
                'clicked',
                this.device.loadPlugin.bind(this.device, name)
            );

            this.error_list.add(row);
        }

        if (this.device.errors.size > 0) {
            this.errata.visible = true;
        } else {
            if (this.visible_child_name === 'errata') {
                this.visible_child_name = 'general';
            }

            this.errata.visible = false;
        }
    }

    _onConnected(device) {
        let type = device.connection_type;
        let action = this.actions.lookup_action(`connect-${type}`);
        action.enabled = !device.connected;

        if (type === 'bluetooth') {
            this._onTcpHostChanged(device.settings);
        } else if (type === 'tcp') {
            this._onBluetoothHostChanged(device.settings);
        }
    }

    _onBluetoothHostChanged(settings) {
        let hasBluetooth = (settings.get_string('bluetooth-host').length);
        this.actions.lookup_action('connect-bluetooth').enabled = hasBluetooth;
    }

    _onActivateBluetooth(button) {
        this.device.settings.set_string('last-connection', 'bluetooth');
        this.device.activate();
    }

    _onTcpHostChanged(settings) {
        let hasLan = (settings.get_string('tcp-host').length);
        this.actions.lookup_action('connect-tcp').enabled = hasLan;
    }

    _onActivateLan(button) {
        this.device.settings.set_string('last-connection', 'tcp');
        this.device.activate();
    }

    _getSettings(name) {
        if (this._gsettings === undefined) {
            this._gsettings = {};
        }

        if (this._gsettings.hasOwnProperty(name)) {
            return this._gsettings[name];
        }

        let meta = imports.service.plugins[name].Metadata;

        this._gsettings[name] = new Gio.Settings({
            settings_schema: gsconnect.gschema.lookup(meta.id, -1),
            path: this.device.settings.path + 'plugin/' + name + '/'
        });

        return this._gsettings[name];
    }

    _onActionsChanged() {
        this._populateActionKeybindings();
    }

    _onDeleteDevice(button) {
        let application = Gio.Application.get_default();
        application.deleteDevice(this.device.id);
    }

    _destroy() {
        this.disconnect_template();

        this.switcher.destroy();
        this.row.destroy();

        this.device.disconnect(this._actionAddedId);
        this.device.disconnect(this._actionRemovedId);
        this.device.disconnect(this._actionEnabledId);

        this.device.disconnect(this._connectedId);
        this.device.settings.disconnect(this._bluetoothHostChangedId);
        this.device.settings.disconnect(this._tcpHostChangedId);
        this.device.settings.disconnect(this._keybindingsId);

        for (let settings of Object.values(this._gsettings)) {
            settings.run_dispose();
        }
    }

    _onSwitcherRowSelected(box, row) {
        this.set_visible_child_name(row.get_name());
    }

    /**
     * Sharing Settings
     */
    async _sharingSettings() {
        this.sharing_list.foreach(row => {
            let label = row.get_child().get_child_at(1, 0);
            let name = row.get_name();
            let settings = this._getSettings(name);

            switch (name) {
                case 'clipboard':
                    let send = settings.get_boolean('send-content');
                    let receive = settings.get_boolean('receive-content');

                    if (send && receive) {
                        label.label = _('Both');
                    } else if (send) {
                        label.label = _('To Device');
                    } else if (receive) {
                        label.label = _('From Device');
                    } else {
                        label.label = _('Off');
                    }
                    break;

                case 'mousepad':
                    if (!this.device.get_outgoing_supported('mousepad.request')) {
                        row.destroy();
                        break;
                    }

                    let control = settings.get_boolean('share-control');
                    label.label = (control) ? _('On') : _('Off');
                    break;

                case 'mpris':
                    if (!this.device.get_outgoing_supported('mpris.request')) {
                        row.destroy();
                        break;
                    }

                    let players = settings.get_boolean('share-players');
                    label.label = (players) ? _('On') : _('Off');
                    break;
            }
        });

        // Separators & Sorting
        this.sharing_list.set_header_func(section_separators);

        this.sharing_list.set_sort_func((row1, row2) => {
            row1 = row1.get_child().get_child_at(0, 0);
            row2 = row2.get_child().get_child_at(0, 0);
            return row1.label.localeCompare(row2.label);
        });
    }

    async _onSharingRowActivated(box, row) {
        let label = row.get_child().get_child_at(1, 0);
        let name = row.get_name();
        let settings = this._getSettings(name);

        switch (name) {
            case 'clipboard':
                let send = settings.get_boolean('send-content');
                let receive = settings.get_boolean('receive-content');

                if (send && receive) {
                    send = false;
                    receive = false;
                    label.label = _('Off');
                } else if (send) {
                    send = false;
                    receive = true;
                    label.label = _('From Device');
                } else if (receive) {
                    send = true;
                    receive = true;
                    label.label = _('Both');
                } else {
                    send = true;
                    receive = false;
                    label.label = _('To Device');
                }

                settings.set_boolean('send-content', send);
                settings.set_boolean('receive-content', receive);
                break;

            case 'mousepad':
                let control = !settings.get_boolean('share-control');
                label.label = (control) ? _('On') : _('Off');
                settings.set_boolean('share-control', control);
                break;

            case 'mpris':
                let players = !settings.get_boolean('share-players');
                label.label = (players) ? _('On') : _('Off');
                settings.set_boolean('share-players', players);
                break;
        }
    }

    /**
     * RunCommand Page
     */
    async _runcommandSettings() {
        let settings = this._getSettings('runcommand');

        // Exclusively enable the editor or add button
        this.command_editor.bind_property(
            'visible',
            this.command_add,
            'sensitive',
            GObject.BindingFlags.INVERT_BOOLEAN
        );

        // Local Command List
        // TODO: backwards compatibility?
        this._commands = settings.get_value('command-list').full_unpack();

        let placeholder = new Gtk.Image({
            icon_name: 'system-run-symbolic',
            hexpand: true,
            halign: Gtk.Align.CENTER,
            margin: 12,
            pixel_size: 32,
            visible: true
        });
        placeholder.get_style_context().add_class('dim-label');

        this.command_list.set_placeholder(placeholder);
        this.command_list.set_sort_func(this._commandSortFunc);
        this.command_list.set_header_func(section_separators);

        this._populateCommands();
    }

    _commandSortFunc(row1, row2) {
        // Placing the command editor next the row it's editing
        if (row1.uuid && row1.uuid === row2.get_name()) {
            return 1;
        } else if (row2.uuid && row2.uuid === row1.get_name()) {
            return -1;
        // Command editor when in disuse
        } else if (!row1.title || !row2.title) {
            return 0;
        }

        return row1.title.localeCompare(row2.title);
    }

    async _insertCommand(uuid) {
        let row = new SectionRow({
            title: this._commands[uuid].name,
            subtitle: this._commands[uuid].command,
            activatable: false,
            selectable: true
        });
        row.set_name(uuid);
        row._subtitle.ellipsize = Pango.EllipsizeMode.MIDDLE;

        this.command_list.add(row);

        return row;
    }

    _onCommandSelected(box) {
        let selected = (box.get_selected_row() !== null);
        this.command_edit.sensitive = selected;
        this.command_remove.sensitive = selected;
    }

    // The [+] button in the toolbar
    async _onAddCommand(button) {
        let uuid = GLib.uuid_string_random();
        this._commands[uuid] = { name: '', command: '' };

        let row = await this._insertCommand(uuid);
        this.command_list.select_row(row);
        this._onEditCommand();
    }

    // The [-] button in the toolbar
    _onRemoveCommand(button) {
        let row = this.command_list.get_selected_row();
        delete this._commands[row.get_name()];

        this._getSettings('runcommand').set_value(
            'command-list',
            GLib.Variant.full_pack(this._commands)
        );

        this._populateCommands();
    }

    // The 'edit' icon in the toolbar
    _onEditCommand(button) {
        let row = this.command_list.get_selected_row();
        let uuid = row.get_name();

        // The editor is open so we're being asked to save
        if (this.command_editor.visible) {
            if (this.command_name.text && this.command_line.text) {
                this._commands[uuid] = {
                    name: this.command_name.text,
                    command: this.command_line.text
                };
            } else {
                delete this._commands[uuid];
            }

            this._getSettings('runcommand').set_value(
                'command-list',
                GLib.Variant.full_pack(this._commands)
            );

            this._populateCommands();

        // The editor is closed so we're being asked to edit
        } else {
            this.command_editor.uuid = uuid;
            this.command_name.text = this._commands[uuid].name;
            this.command_line.text = this._commands[uuid].command;

            this.command_edit.get_child().icon_name = 'document-save-symbolic';

            row.visible = false;
            this.command_editor.visible = true;
            this.command_name.has_focus = true;

            this.command_list.invalidate_sort();
        }
    }

    // The 'folder' icon in the command editor GtkEntry
    // TODO: non-blocking dialog
    _onBrowseCommand(entry, icon_pos, event) {
        let filter = new Gtk.FileFilter();
        filter.add_mime_type('application/x-executable');

        let dialog = new Gtk.FileChooserDialog({ filter: filter });
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Open'), Gtk.ResponseType.OK);

        if (dialog.run() === Gtk.ResponseType.OK) {
            this.command_line.text = dialog.get_filename();
        }

        dialog.destroy();
    }

    async _populateCommands() {
        delete this.command_editor.uuid;
        this.command_name.text = '';
        this.command_line.text = '';
        this.command_edit.get_child().icon_name = 'document-edit-symbolic';
        this.command_editor.visible = false;

        this.command_list.foreach(row => {
            if (row !== this.command_editor) {
                row.destroy();
            }
        });

        let uuids = Object.keys(this._commands);
        uuids.map(uuid => this._insertCommand(uuid));
    }

    /**
     * Notification Settings
     */
    async _notificationSettings() {
        let settings = this._getSettings('notification');

        settings.bind(
            'send-notifications',
            this.share_notifications,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'send-notifications',
            this.notification_apps,
            'sensitive',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.notification_apps.set_sort_func((row1, row2) => {
            return row1.title.localeCompare(row2.title);
        });
        this.notification_apps.set_header_func(section_separators);

        this._populateApplications(settings);
    }

    async _onNotificationRowActivated(box, row) {
        let settings = this._getSettings('notification');
        let applications = {};

        try {
            applications = JSON.parse(settings.get_string('applications'));
        } catch (e) {
            applications = {};
        }

        applications[row.title].enabled = !applications[row.title].enabled;
        row.widget.label = (applications[row.title].enabled) ? _('On') : _('Off');
        settings.set_string('applications', JSON.stringify(applications));
    }

    async _populateApplications(settings) {
        let applications = await this._queryApplications(settings);

        for (let name in applications) {
            let row = new SectionRow({
                icon_name: applications[name].iconName,
                title: name,
                height_request: 48,
                widget: new Gtk.Label({
                    label: applications[name].enabled ? _('On') : _('Off'),
                    margin_end: 12,
                    halign: Gtk.Align.END,
                    hexpand: true,
                    valign: Gtk.Align.CENTER,
                    vexpand: true,
                    visible: true
                })
            });

            this.notification_apps.add(row);
        }
    }

    // TODO: move to notifications.js
    async _queryApplications(settings) {
        let applications = {};

        try {
            applications = JSON.parse(settings.get_string('applications'));
        } catch (e) {
            applications = {};
        }

        let appInfos = [];
        let ignoreId = 'org.gnome.Shell.Extensions.GSConnect.desktop';

        // Query Gnome's notification settings
        for (let appSettings of Object.values(this.service.notificationListener.applications)) {
            let appId = appSettings.get_string('application-id');

            if (appId !== ignoreId) {
                let appInfo = Gio.DesktopAppInfo.new(appId);

                if (appInfo) {
                    appInfos.push(appInfo);
                }
            }
        }

        // Include applications that statically declare to show notifications
        // TODO: if g-s-d does this already, maybe we don't have to
        Gio.AppInfo.get_all().map(appInfo => {
            if (appInfo.get_id() !== ignoreId &&
                appInfo.get_boolean('X-GNOME-UsesNotifications')) {
                appInfos.push(appInfo);
            }
        });

        // Update GSettings
        appInfos.map(appInfo => {
            let appName = appInfo.get_name();
            let icon = appInfo.get_icon();

            if (appName && !applications[appName]) {
                applications[appName] = {
                    iconName: (icon) ? icon.to_string() : 'application-x-executable',
                    enabled: true
                };
            }
        });

        settings.set_string('applications', JSON.stringify(applications));

        return applications;
    }

    /**
     * Telephony Settings
     */
    async _telephonySettings() {
        let settings = this._getSettings('telephony');

        // SMS
        settings.bind(
            'handle-sms',
            this.handle_sms,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'handle-calls',
            this.handle_calls,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'handle-calls',
            this.calls_list,
            'sensitive',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.telephony_list.set_header_func(section_separators);

        // Settings Actions
        let actions = new Gio.SimpleActionGroup();
        actions.add_action(settings.create_action('ringing-volume'));
        actions.add_action(settings.create_action('ringing-pause'));

        actions.add_action(settings.create_action('talking-volume'));
        actions.add_action(settings.create_action('talking-microphone'));
        actions.add_action(settings.create_action('talking-pause'));

        // Menu Models
        this.ringing_button.set_menu_model(
            this.service.get_menu_by_id('ringing-popover')
        );

        this.talking_button.set_menu_model(
            this.service.get_menu_by_id('talking-popover')
        );

        this.insert_action_group('telephony', actions);

        this.calls_list.set_header_func(section_separators);
    }

    /**
     * Keyboard Shortcuts
     */
    async _keybindingSettings() {
        this._keybindingsId = this.device.settings.connect(
            'changed::keybindings',
            this._populateKeybindings.bind(this)
        );

        this.shortcuts_actions_list.set_header_func(section_separators);
        this.shortcuts_actions_list.set_sort_func((row1, row2) => {
            return row1.title.localeCompare(row2.title);
        });

        this.shortcuts_commands_list.set_header_func(section_separators);
        this.shortcuts_commands_list.set_sort_func((row1, row2) => {
            return row1.title.localeCompare(row2.title);
        });

        this._populateKeybindings();
    }

    async _populateKeybindings() {
        try {
            await this._populateActionKeybindings();
            await this._populateCommandKeybindings();
        } catch (e) {
            logError(e);
        }
    }

    async _populateActionKeybindings() {
        this.shortcuts_actions_list.foreach(row => row.destroy());

        let keybindings = this.device.settings.get_value('keybindings').full_unpack();

        // TODO: Backwards compatibility; remove later
        if (typeof keybindings === 'string') {
            this.device.settings.set_value(
                'keybindings',
                new GLib.Variant('a{sv}', {})
            );
            // A ::changed signal should be emitted so we'll return
            return;
        }

        // TODO: Device Menu shortcut
        for (let name of this.device.list_actions().sort()) {
            let action = this.device.lookup_action(name);

            if (action.parameter_type === null) {
                let widget = new Gtk.Label({
                    label: _('Disabled'),
                    visible: true
                });
                widget.get_style_context().add_class('dim-label');

                if (keybindings[action.name]) {
                    let accel = Gtk.accelerator_parse(keybindings[action.name]);
                    widget.label = Gtk.accelerator_get_label(...accel);
                }

                let row = new SectionRow({
                    icon_name: action.icon_name,
                    title: action.summary,
                    subtitle: action.description,
                    widget: widget
                });
                row._icon.pixel_size = 16;
                row.action = action.name;
                row.summary = action.summary;
                this.shortcuts_actions_list.add(row);
            }
        }

        this.shortcuts_actions_list.invalidate_headers();
    }

    async _onResetActionsShortcuts(button) {
        let keybindings = this.device.settings.get_value('keybindings').full_unpack();

        for (let action in keybindings) {
            if (!action.includes('::')) {
                delete keybindings[action];
            }
        }

        this.device.settings.set_value(
            'keybindings',
            GLib.Variant.full_pack(keybindings)
        );
    }

    async _onResetCommandsShortcuts(button) {
        let keybindings = this.device.settings.get_value('keybindings').full_unpack();

        for (let action in keybindings) {
            if (action.includes('::')) {
                delete keybindings[action];
            }
        }

        this.device.settings.set_value(
            'keybindings',
            GLib.Variant.full_pack(keybindings)
        );
    }

    async _populateCommandKeybindings() {
        this.shortcuts_commands_list.foreach(row => row.destroy());

        let keybindings = this.device.settings.get_value('keybindings').full_unpack();

        // Commands
        let runcommand = this.device.lookup_plugin('runcommand');
        let remoteCommands = (runcommand) ? runcommand.remote_commands : {};
        let hasCommands = (Object.keys(remoteCommands).length > 0);
        this.shortcuts_commands_title.visible = hasCommands;
        this.shortcuts_commands.visible = hasCommands;

        for (let uuid in remoteCommands) {
            let command = remoteCommands[uuid];
            let commandAction = `executeCommand::${uuid}`;

            let widget = new Gtk.Label({
                label: _('Disabled'),
                visible: true
            });
            widget.get_style_context().add_class('dim-label');

            if (keybindings[commandAction]) {
                let accel = Gtk.accelerator_parse(keybindings[commandAction]);
                widget.label = Gtk.accelerator_get_label(...accel);
            }

            let row = new SectionRow({
                title: command.name,
                subtitle: command.command,
                widget: widget
            });
            row.action = commandAction;
            row.summary = command.name;
            this.shortcuts_commands_list.add(row);
        }

        for (let action in keybindings) {
            if (action.includes('::')) {
                let uuid = action.split('::')[1];

                if (!remoteCommands.hasOwnProperty(uuid)) {
                    delete keybindings[action];
                }
            }
        }
    }

    async _onShortcutRowActivated(box, row) {
        try {
            let keybindings = this.device.settings.get_value('keybindings').full_unpack();
            let accelerator = await Keybindings.get_accelerator(
                box.get_toplevel(),
                row.summary,
                keybindings[row.action]
            );

            if (accelerator) {
                keybindings[row.action] = accelerator;
            } else {
                delete keybindings[row.action];
            }

            this.device.settings.set_value(
                'keybindings',
                GLib.Variant.full_pack(keybindings)
            );
        } catch (e) {
            logError(e);
        }
    }

    /**
     * Advanced Page
     */
    async _pluginSettings() {
        let reloadPlugins = new Gio.SimpleAction({
            name: 'reload-plugins',
            parameter_type: null
        });
        reloadPlugins.connect(
            'activate',
            () => this.device.reloadPlugins()
        );
        this.actions.add_action(reloadPlugins);

//        this.device.settings.connect(
//            'changed::disabled-plugins',
//            this._populatePlugins.bind(this)
//        );

        this._populatePlugins();
    }

    async _populatePlugins() {
        this.plugin_list.foreach(row => {
            row.widget.disconnect(row.widget._togglePluginId);
            row.destroy()
        });

        for (let plugin of this.device.supported_plugins) {
            let row = new Gtk.ListBoxRow({
                activatable: true,
                selectable: false,
                visible: true
            });
            this.plugin_list.add(row);

            let widget = new Gtk.CheckButton({
                label: plugin,
                active: this.device.get_plugin_allowed(plugin),
                valign: Gtk.Align.CENTER,
                visible: true
            });
            widget._togglePluginId = widget.connect(
                'notify::active',
                this._togglePlugin.bind(this)
            );
            row.add(widget);
        }
    }

    async _togglePlugin(widget) {
        let name = widget.label;
        let disabled = this.device.settings.get_strv('disabled-plugins');

        if (disabled.includes(name)) {
            disabled.splice(disabled.indexOf(name), 1);
            this.device.loadPlugin(name);
        } else {
            this.device.unloadPlugin(name);
            disabled.push(name);
        }

        this.device.settings.set_strv('disabled-plugins', disabled);

        if (this.hasOwnProperty(name)) {
            this[name].visible = this.device.get_plugin_allowed(name);
        }
    }
});
