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
        ['directory', 'linked_directory']
      ],
      source: function(target) {
        if (target.type === 'linked_directory') {
          target = target.link;
        }

        this.changeDirectory(target);
        sfx.play('cd');
      },
    },

    'move': {
      name: 'move',
      arguments: [
        ['file', 'encryption_key', 'encrypted_file', 'host_key', 'host_file'],
        ['directory', 'linked_directory']
      ],
      source: function(file, target) {
        if (!file.permission) {
          this.log('permission denied');
          sfx.play('cancel');
          return;
        }

        if (target.type === 'linked_directory') {
          target = target.link;
        }
          
        var i = file.parent.listing.indexOf(file.name);

        file.parent.data.splice(i, 1);
        file.parent.listing.splice(i, 1);
        file.parent = target;
        target.data.push(file);
        target.listing.push(file.name);
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
        
        var i = file.parent.listing.indexOf(file.name);
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

        var i = this.scriptObj.parent.listing.indexOf(this.scriptObj);
        var newFile = { name: 'blank', type: 'file' }
        decorateLevelData(newFile, this.directory);
        this.directory.data.splice(i, 0, newFile);
        this.directory.listing.splice(i, 0, newFile.name);
        // this.directory.listing.push(newFile.name);
        // this.directory.data.push(newFile);
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
        var i = file.parent.listing.indexOf(file.name);
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
          key.type = 'used_key';
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

    'connect': {
      name: 'connect',
      arguments: [
        ['host_key'],
        ['host_file']
      ],
      source: function(key, host) {
        this.log('resolving host', host.data);
        this.log('authenticating...');

        if (key.data !== host.key_data) {
          sfx.play('cancel');
          this.log('incorrect key, disconnecting');
        } else {
          Shell.loadLevel(host.data);
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
    }
  };


  var Shell = {
    directory: null,
    
    levelPath: null,

    console: document.getElementById('console'),

    listing: blankBoard.slice(),

    script: null,

    interactCell: { x: null, y: null },

    selectedCellIndicies: [],

    scriptParams: [],

    getSourceFile: function(file) {
      var i = file.parent.listing.indexOf(file.name);
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
        if (data.welcome) {
          Shell.log('SERVER:', data.welcome);
        }
        Shell.changeDirectory(data);
      }).fail(function(err) {
        Shell.log('err! something went wrong!');
        Shell.log('this is not part of the game.  sorry!');
        debugger;
      });
    },

    onLoadLevelCallbacks: [],

    log: function() {
      var preText = Shell.console.innerText;
      preText += Array.prototype.join.call(arguments, ' ') + '\n';
      if (preText.length > 10000) {
        preText = preText.slice(preText.length - 10000);
      }
      Shell.console.innerText = preText;
    },

    relog: function() {
      var preText = Shell.console.innerText;
      
      var i = preText.lastIndexOf('\n');
      preText = preText.slice(0, i);
      i = preText.lastIndexOf('\n');
      preText = preText.slice(0, i + 1);

      preText += Array.prototype.join.call(arguments, ' ') + '\n';
      if (preText.length > 10000) {
        preText = preText.slice(preText.length - 10000);
      }
      Shell.console.innerText = preText;
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

    changeDirectory: function(directory) {
      Shell.clearDirectory();
      if (!directory) {
        return;
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
        } else if (obj.type === 'directory' || obj.type === 'linked_directory') {
          Shell.setShellScript(Bin.cd, x, y);
        } else {
          Shell.setShellScript(Bin.inspect, x, y);
        }
        Shell.log('$')
      } else {
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

  var userScripts = [
    { type: 'user_script', name: 'reload' },
  ];

  var App = React.createClass({
    getInitialState: function() {
      return {
        activeBoard: blankBoard.slice(),
        activeDirectory: this.props.levelData || null,
      };
    },
    
    componentWillMount: function() {
      Shell.onChangeDirectoryCallbacks.push(this.onShellDirectoryChange);
      Shell.changeDirectory(this.state.activeDirectory);
    },

    render: function() {
      return <div className="screen">
        <Board className="user-scripts" cells={userScripts} />
        <Board className="shell" cells={this.state.activeBoard} />
      </div>
    },

    onShellDirectoryChange: function() {
      this.setState({
        activeBoard: Shell.listing,
      });
    },
  });

  var Cell = React.createClass({
    render: function() {

      return <a className={'cell ' + this.props.type + (this.props.selected ? ' selected' : '')}
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

  function decorateLevelData(data, parent) {
    if (!data) {
      return;
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
        type: 'linked_directory',
        link: parent,
      });
    }

    if (data.type === 'directory' || data.type === 'root_directory') {
      data.listing = data.data.map(function(child) {
        return child ? child.name : null;
      });

      // call recursively
      data.data.forEach(function(child) {
        decorateLevelData(child, data);
      });
    }
  }
  
  React.render(
    <App />,
    mountNode
  );
  Shell.loadLevel('level0');

});