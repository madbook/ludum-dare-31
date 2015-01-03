React.initializeTouchEvents(true);

$(function() {
  FastClick.attach(document.body);

  var sfx = new SoundEffectManager();

  // load some files by passing it a url and a name
  sfx.loadFile('sounds/cancel.wav', 'cancel');
  sfx.loadFile('sounds/cd.wav', 'cd');
  sfx.loadFile('sounds/connect.wav', 'connect');
  sfx.loadFile('sounds/create.wav', 'create');
  sfx.loadFile('sounds/decrypt.wav', 'decrypt');
  sfx.loadFile('sounds/look.wav', 'look');
  sfx.loadFile('sounds/move.wav', 'move');
  sfx.loadFile('sounds/remove.wav', 'remove');
  sfx.loadFile('sounds/select.wav', 'select');


  var mountNode = document.getElementById('app');

  var blankBoard = [];
  
  var i = 16;
  while (i--) {
    blankBoard.push(1);
  }

  var defaultUserScripts = [
    { type: 'user_script', name: 'reload' },
  ];

  var consoleUserScripts = [
    { type: 'user_script', name: 'reload' },
    { type: 'user_script', name: 'console' },
    { type: 'user_script', name: 'connect' },
    { type: 'user_script', name: 'move' },
    { type: 'user_script', name: 'decrypt' },
    { type: 'user_script', name: 'add' },
    { type: 'user_script', name: 'remove' },
    { type: 'user_script', name: 'add_dir' },
    { type: 'user_script', name: 'remove_dir' },
    { type: 'user_script', name: 'encrypt' },
    { type: 'user_script', name: 'add_vm' },
    { type: 'user_script', name: 'add_key' },
    { type: 'user_script', name: 'push' },
    { type: 'user_script', name: 'pull' }
  ];


  function generateKey(length) {
    length = length || 8;
    if (length > 8) {
      return generateKey(length % 8) + generateKey(length - 8);
    } else {
      var keyGen = Math.pow(36, length) - 1;
      var keyData = Math.floor(keyGen + 1 + Math.random() * keyGen)
                        .toString(36)
                        .slice(1)
                        .toUpperCase();
      return keyData;
    }
  };


  var Bin = {
    'inspect': {
      name: 'inspect',
      arguments: [
        ['file', 'encrypted_file', 'encryption_key']
      ],
      source: function(file) {
        this.log('name:', file.name);
        this.log('type:', file.type);
        if (file.data) {
          this.log(file.data);
        }
        sfx.play('look');
      },
    },

    'cd': {
      name: 'cd',
      arguments: [
        ['directory', 'linked_directory', 'linked_directory_parent']
      ],
      source: function(target) {
        if (target.type === 'linked_directory' || target.type === 'linked_directory_parent') {
          target = target.link;
        }

        this.changeDirectory(target);
        sfx.play('cd');
      },
    },

    'move': {
      name: 'move',
      arguments: [
        ['file', 'encryption_key', 'encrypted_file', 'host_key', 'host_file', 'vm_file'],
        ['directory', 'linked_directory', 'linked_directory_parent']
      ],
      source: function(file, target) {
        if (!file.permission) {
          this.log('permission denied');
          sfx.play('cancel');
          return;
        }

        if (target.type === 'linked_directory' || target.type === 'linked_directory_parent') {
          target = target.link;
        }
          
        var i = file.parent.listing.indexOf(file.id36);

        file.parent.data.splice(i, 1);
        file.parent.listing.splice(i, 1);
        file.parent = target;
        target.data.push(file);
        target.listing.push(file.id36);
        sfx.play('move');
        this.refresh();
      },
      help: 'move a file into another directory',
    },

    'remove': {
      name: 'remove',
      arguments: [
        ['file'],
      ],
      source: function(file) {
        if (!file.permission) {
          this.log('permission denied');
          sfx.play('cancel');
          return;
        }

        var realFile = this.getSourceFile(file);
        realFile.parent = null;
        
        var i = file.parent.listing.indexOf(file.id36);
        file.parent.data.splice(i, 1);
        file.parent.listing.splice(i, 1);

        file.parent = null;
        sfx.play('remove');
      },
      help: 'remove a file',
    },

    'add': {
      name: 'add',
      arguments: [],
      source: function() {
        if (this.directory.listing.length >= 16) {
          this.log('directory full');
          sfx.play('cancel');
          return;
        }

        var newFile = { name: 'blank', type: 'file', permission: 1 };
        decorateLevelData(newFile, this.directory);

        if (this.scriptObj.type === 'script') {
          var i = this.scriptObj.parent.listing.indexOf(this.scriptObj);
          this.directory.data.splice(i, 0, newFile);
          this.directory.listing.splice(i, 0, newFile.id36);
        } else {
          this.directory.listing.push(newFile.id36);
          this.directory.data.push(newFile);
        }

        sfx.play('create');
        this.log('created new file');
        this.refresh();
      },
    },

    'decrypt': {
      name: 'decrypt',
      arguments: [
        ['encryption_key'],
        ['encrypted_file']
      ],
      source: function(key, file) {
        var i = file.parent.listing.indexOf(file.id36);
        file = file.parent.data[i];
        
        this.log('decrypting', file.name);
        this.log('...');

        try {
          var newFile = atob(file.data);
          newFile = JSON.parse(newFile);
          file.parent.data[i] = newFile;
          decorateLevelData(newFile, file.parent);
          file.parent = null;
          key = this.getSourceFile(key);
          key.type = 'key';
          this.log(file.name, 'decrypted to', newFile.name);
          sfx.play('decrypt');
        } catch(e) {
          this.log('could not decrypt file');    
          sfx.play('cancel');
        }

        this.refresh();
      },
      help: 'decrypt an encrypted file using a key',
    },

    'encrypt': {
      name: 'encrypt',
      arguments: [
        ['key'],
        ['directory', 'vm_file', 'host_file', 'host_key', 'encryption_key', 'file', 'script'],
      ],
      source: function(keyFile, file) {
        if (this.directory.listing.length >= 16) {
          this.log('directory full');
          sfx.play('cancel');
          return;
        }

        keyFile = this.getSourceFile(keyFile);
        keyFile.type = 'encryption_key';
        
        var i = file.parent.listing.indexOf(file.id36);
        delete file.parent;
        var quoteUnquoteEncryptedData = btoa(JSON.stringify(file));
        var encFile = {
          name: file.name,
          type: 'encrypted_file',
          key_data: keyFile.data,
          data: quoteUnquoteEncryptedData,
          permission: 1,
        };
        
        decorateLevelData(encFile, this.directory);
        this.directory.data.splice(i, 1, encFile);
        this.directory.listing.splice(i, 1, encFile.id36);
        sfx.play('decrypt');
      },
    },

    'connect': {
      name: 'connect',
      arguments: [
        ['host_key'],
        ['host_file', 'vm_file']
      ],
      source: function(key, host) {

        if (key.data !== host.key_data) {
          sfx.play('cancel');
          this.log('incorrect key, disconnecting');
        } else if (host.type === 'host_file') {
          this.log('resolving host', host.data);
          this.log('authenticating...');
          Shell.loadLevel(host.data);
        } else if (host.type === 'vm_file') {
          sfx.play('connect');
          this.log('connecting to virtual machine...');
          Shell.changeDirectory(host.data, host.data.welcome);
        } else {
          sfx.play('cancel');
        }

        this.refresh();
      },
      help: 'connect to a remote server',
    },

    'reload': {
      name: 'reload',
      arguments: [],
      source: function() {
        this.log('reconnecting to host');
        this.loadLevel(this.levelPath);
      },
    },

    'add_dir': {
      name: 'add_dir',
      arguments: [],
      source: function() {
        if (this.directory.listing.length >= 16) {
          this.log('directory full');
          sfx.play('cancel');
          return;
        }

        var newFile = {
          type: 'directory',
          name: 'new_dir',
          permission: 1,
          data: [],
        };

        if (this.scriptObj.type === 'script') {
          var i = this.scriptObj.parent.listing.indexOf(this.scriptObj);
          this.directory.data.splice(i, 0, newFile);
          this.directory.listing.splice(i, 0, newFile.id36);
        } else {
          this.directory.listing.push(newFile.id36);
          this.directory.data.push(newFile);
        }

        decorateLevelData(newFile, this.directory);
        sfx.play('create');
        this.log('created new directory');
        this.refresh();
      }
    },

    'remove_dir': {
      name: 'remove_dir',
      arguments: [
        ['directory'],
      ],
      source: function(directory) {
        if (!directory.permission) {
          this.log('permission denied');
          sfx.play('cancel');
          return;
        }

        var realdirectory = this.getSourceFile(directory);
        realdirectory.parent = null;

        var i = directory.parent.listing.indexOf(directory.id36);
        directory.parent.data.splice(i, 1);
        directory.parent.listing.splice(i, 1);

        directory.parent = null;
        sfx.play('remove');
      },
      help: 'remove a directory and all its contents',
    },

    'add_vm': {
      name: 'add_vm',
      arguments: ['key'],
      source: function(keyFile) {
        if (this.directory.listing.length >= 16) {
          this.log('directory full');
          sfx.play('cancel');
          return;
        }
        
        keyFile = this.getSourceFile(keyFile);
        keyFile.type = 'host_key';

        var newVm = {
          type: 'vm_file',
          name: 'new_vm',
          permission: 1,
          key_data: keyFile.data,
          data: {
            type: "root_directory",
            name: "/",
            offset: 0,
            welcome: "welcome <USERNAME>. this is a virtual machine!",
            data: [],
          },
        };
        decorateLevelData(newVm, this.directory);
        decorateLevelData(newVm.data, null);

        if (this.scriptObj.type === 'script') {
          var i = this.scriptObj.parent.listing.indexOf(this.scriptObj);
          this.directory.data.splice(i, 0, newVm);
          this.directory.listing.splice(i, 0, newVm.id36);
        } else {
          this.directory.data.push(newVm);
          this.directory.listing.push(newVm.id36);
        }

        sfx.play('create');
        this.log('created new virtual machine and key file');
        this.refresh();
      },
    },

    'push': {
      name: 'push',
      arguments: [],
      source: function() {
        var dir = this.directory;
        while (dir) {
          dir.offset += 1;
          dir.offset %= 16;
          dir = dir.parent;
        }
        sfx.play('move');
        this.refresh();
      },
    },

    'pull': {
      name: 'pull',
      arguments: [],
      source: function() {
        var dir = this.directory;
        while (dir) {
          dir.offset += 15;
          dir.offset %= 16;
          dir = dir.parent;
        }
        sfx.play('move');
        this.refresh();
      },
    },

    'add_key': {
      name: 'add_key',
      arguments: [],
      source: function() {
        if (this.directory.listing.length >= 16) {
          this.log('directory full');
          sfx.play('cancel');
          return;
        }

        var keyData = generateKey(8);

        var newKey = {
          type: 'key',
          data: keyData,
          name: 'key',
          permission: 1,
        }

        decorateLevelData(newKey, this.directory);

        if (this.scriptObj.type === 'script') {
          var i = this.scriptObj.parent.listing.indexOf(this.scriptObj);
          this.directory.data.splice(i, 0, newKey);
          this.directory.listing.splice(i, 0, newKey.id36);
        } else {
          this.directory.listing.push(newKey.id36);
          this.directory.data.push(newKey);
        }

        sfx.play('create');
        this.log('generated new key');
        this.refresh();
      },
    },

    'console': {
      name: 'console',
      arguments: [],
      source: function() {
        sfx.play('cd');

        if (this.showingConsole) {
          this.userScripts = defaultUserScripts;
          this.log('console deactivated');
        } else {
          this.userScripts = consoleUserScripts;
          this.log('console activated');
        }

        this.showingConsole = !this.showingConsole;
        this.refresh();
      },
    },
  };


  window.enableConsole = function() {
    defaultUserScripts.push(
      { type: 'user_script', name: 'console' }
    );
    Shell.log('console enabled');
    sfx.play('move');
    Shell.refresh();
  };


  var Shell = {
    directory: null,
    
    levelPath: null,

    console: document.getElementById('console'),

    listing: blankBoard.slice(),

    script: null,

    showingConsole: false,

    consoleEnabled: false,

    userScripts: defaultUserScripts,

    interactCell: { x: null, y: null },

    selectedCellIndicies: [],

    scriptParams: [],

    getSourceFile: function(file) {
      var i = file.parent.listing.indexOf(file.id36);
      return file.parent.data[i];
    },

    loadLevel: function(path) {
      Shell.levelPath = path;
      sfx.play('connect');
      Shell.log('connecting to', path);
      Shell.log('...');
      $.getJSON('levels/' + path + '.json').then(function(data) {
        Shell.log('connected!');
        decorateLevelData(data, null);
        Shell.changeDirectory(data, data.welcome);
      }).fail(function(err) {
        Shell.log('err! something went wrong!');
        Shell.log('this is not part of the game.  sorry!');
        debugger;
      });
    },

    onLoadLevelCallbacks: [],

    log: function() {
      var preText = Shell.console.textContent;
      preText += Array.prototype.join.call(arguments, ' ') + '\n';
      if (preText.length > 10000) {
        preText = preText.slice(preText.length - 10000);
      }
      Shell.console.textContent = preText;
    },

    relog: function() {
      var preText = Shell.console.textContent;
      
      var i = preText.lastIndexOf('\n');
      preText = preText.slice(0, i);
      i = preText.lastIndexOf('\n');
      preText = preText.slice(0, i + 1);

      preText += Array.prototype.join.call(arguments, ' ') + '\n';
      if (preText.length > 10000) {
        preText = preText.slice(preText.length - 10000);
      }
      Shell.console.textContent = preText;
    },

    getScriptPath: function() {
      var parts = ['$'];
      if (Shell.script) {
        parts.push(Shell.script.name);

        for (var i = 0, l = Shell.script.arguments.length; i < l; i++) {
          if (Shell.scriptParams[i]) {
            parts.push(Shell.scriptParams[i].name);
          } else {
            parts.push('<' + Shell.script.arguments[i][0] + '>');
          }
        }
      }
      
      return parts;
    },

    clearDirectory: function() {
      var i = 16;
      while (i--) {
        Shell.listing[i] = 1;
      }
    },

    changeDirectory: function(directory, message) {
      Shell.clearDirectory();
      if (!directory) {
        return;
      }

      if (message) {
        Shell.log('SERVER:', message);
      }

      var l = directory.data.length;
      var offset = directory.offset;
      var i;
      

      while (l--) {
        i = (l + offset) % 16;
        Shell.listing[i] = directory.data[l];
      }

      Shell.directory = directory;
      Shell.fireCallbacks(Shell.onChangeDirectoryCallbacks);
    },

    onChangeDirectoryCallbacks: [],

    refresh: function() {
      Shell.changeDirectory(Shell.directory);
    },

    fireCallbacks: function(arr) {
      arr.forEach(function(cb) { cb(); });
    },

    interact: function(obj, x, y) {
      if (!Shell.script) {
        if ((obj.type === 'script' || obj.type === 'user_script')  && Bin[obj.name]) {
          Shell.setShellScript(Bin[obj.name], x, y, obj);
          
          if (Shell.script.arguments.length === 0) {
            Shell.log.apply(Shell, Shell.getScriptPath());
            Shell.script.source.call(Shell);
            Shell.setShellScript(null);
          } else {
            Shell.log('$', obj.name);

            if (Bin[obj.name].help) {
              Shell.log(Bin[obj.name].help);
            }

            sfx.play('select');
            Shell.log.apply(Shell, Shell.getScriptPath());
          }

          Shell.refresh();
          return;
        } else if (obj.type === 'directory' || obj.type === 'linked_directory' || obj.type === 'linked_directory_parent') {
          Shell.setShellScript(Bin.cd, x, y);
        } else {
          Shell.setShellScript(Bin.inspect, x, y);
        }
        Shell.log('$')
      } else if (Shell.script.type === 'script') {
        var xOff = Math.abs(Shell.interactCell.x - x);
        var yOff = Math.abs(Shell.interactCell.y - y);

        if (xOff + yOff === 1) {
          Shell.interactCell.x = x;
          Shell.interactCell.y = y;
        } else {
          Shell.setShellScript(null);
          Shell.log('arguments must connect, aborting');
          sfx.play('cancel');
          Shell.refresh();
          return;
        }
      }

      var argNum = Shell.scriptParams.length;

      if (Shell.script.arguments[argNum] && Shell.script.arguments[argNum].indexOf(obj.type) >= 0) {
        Shell.scriptParams.push(obj);
        Shell.selectedCellIndicies.push(y * 4 + x);
        Shell.relog.apply(Shell, Shell.getScriptPath());

        if (Shell.scriptParams.length === Shell.script.arguments.length) {
          Shell.script.source.apply(Shell, Shell.scriptParams);
          Shell.setShellScript(null);
        } else {
          sfx.play('select');
        }

        Shell.refresh();
      } else {
        Shell.log('invalid arguments');
        sfx.play('cancel');
        Shell.setShellScript(null);
        Shell.refresh();
      }

    },

    setShellScript: function(script, x, y, obj) {
      Shell.selectedCellIndicies.length = 0;
      Shell.scriptParams.length = 0;

      if (script) {
        Shell.script = script;
        Shell.scriptObj = obj;
        Shell.interactCell.x = x;
        Shell.interactCell.y = y;
        Shell.selectedCellIndicies.push(y * 4 + x);
      } else {
        Shell.script = null;
        Shell.scriptObj = null;
        Shell.interactCell.x = null;
        Shell.interactCell.y = null;
      }
    },
  }

  var App = React.createClass({
    getInitialState: function() {
      return {
        activeBoard: blankBoard.slice(),
        activeDirectory: this.props.levelData || null,
        userScripts: defaultUserScripts,
      };
    },
    
    componentWillMount: function() {
      Shell.onChangeDirectoryCallbacks.push(this.onShellDirectoryChange);
      Shell.changeDirectory(this.state.activeDirectory);
    },

    render: function() {
      return <div className="screen">
        <Board className="user-scripts" cells={this.state.userScripts} />
        <Board className="shell" cells={this.state.activeBoard} />
      </div>
    },

    onShellDirectoryChange: function() {
      this.setState({
        activeBoard: Shell.listing,
        userScripts: Shell.userScripts,
      });
    },
  });

  var Cell = React.createClass({
    render: function() {
      var cellClasses = [
        'cell',
        this.props.type,
        this.props.name || '',
        this.props.selected ? 'selected' : '',
      ];
      return <a className={cellClasses.join(' ')}
                onClick={this.handleClick}>
        <canvas className="cell-contents" width="100" height="100" />
        <div className="cell-icon" />
        <div className="cell-name">{this.props.name}</div>
      </a>;
    },

    handleClick: function() {
      var x = this.props.i % 4;
      var y = (this.props.i - x) / 4 | 0;
      Shell.interact(this.props, x, y);
    },
  });
  
  var Board = React.createClass({
    render: function() {
      return <div className={'board ' + this.props.className}>
        {this.props.cells.map(this.renderCell)}
      </div>;
    },

    renderCell: function(cell, i) {
      var selected = Shell.selectedCellIndicies.indexOf(i) > -1;
      return <Cell {...cell} i={i} selected={selected} />;
    },
  });

  var nextId = 0;

  function decorateLevelData(data, parent) {
    if (!data) {
      return;
    }

    if (!data.id36) {
      data.id36 = nextId.toString(36);
      nextId += 1;
    }

    if (parent && !data.parent) {
      data.parent = parent;
    }

    if (data.type === 'directory' || data.type === 'root_directory') {
      data.data.unshift({
        name: './',
        type: 'linked_directory',
        link: data,
      });
    }

    if (data.type === 'directory' && parent) {
      // set offset for child directories
      data.offset = parent.offset + parent.data.indexOf(data);
      
      // add ../ directory
      data.data.unshift({
        name: '../',
        type: 'linked_directory_parent',
        link: parent,
      });
    }

    if (data.type === 'directory' || data.type === 'root_directory') {
      // call recursively
      data.data.forEach(function(child) {
        decorateLevelData(child, data);
      });

      data.listing = data.data.map(function(child) {
        return child ? child.id36 : null;
      });
    }
  }
  
  React.render(
    <App />,
    mountNode
  );
  Shell.loadLevel('level0');

});