React.initializeTouchEvents(true);

$(function() {
  var mountNode = document.getElementById('app');

  var blankBoard = [];
  
  var i = 16;
  while (i--) {
    blankBoard.push(1);
  }

  var Shell = {
    directory: blankBoard.slice(),

    clearDirectory: function() {
      var i = 16;
      while (i--) {
        Shell.directory[i] = 1;
      }
    },

    changeDirectory: function(directory) {
      var l = directory.data.length;
      var offset = directory.offset;
      var i;
      
      Shell.clearDirectory();

      while (l--) {
        i = (l + offset) % 16;
        Shell.directory[i] = directory.data[l];
      }

      Shell.fireCallbacks(Shell.onChangeDirectoryCallbacks);
    },

    onChangeDirectoryCallbacks: [],

    fireCallbacks: function(arr) {
      arr.forEach(function(cb) { cb(); });
    },
  }

  var App = React.createClass({
    getInitialState: function() {
      return {
        activeBoard: blankBoard.slice(),
        activeDirectory: this.props.levelData,
      };
    },
    
    componentWillMount: function() {
      Shell.onChangeDirectoryCallbacks.push(this.onShellDirectoryChange);
      Shell.changeDirectory(this.state.activeDirectory);
    },

    render: function() {
      return <Board cells={this.state.activeBoard} />;
    },

    onShellDirectoryChange: function() {
      this.setState({
        activeBoard: Shell.directory,
      });
    },
  });

  var Cell = React.createClass({
    render: function() {
      return <a className={'cell ' + this.props.type}
                onClick={this.handleClick}>
        <canvas className="cell-contents" width="100" height="100" />
      </a>;
    },

    handleClick: function() {
      if (this.props.type === 'directory') {
        Shell.changeDirectory(this.props);
      } else if (this.props.type === 'linked_directory') {
        Shell.changeDirectory(this.props.link);
      }
    },
  });
  
  var Board = React.createClass({
    render: function() {
      return <div className="board">
        {this.props.cells.map(this.renderCell)}
      </div>;
    },

    renderCell: function(cell) {
      return <Cell {...cell} />;
    },
  });

  function decorateLevelData(data, parent) {
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
      // call recursively
      data.data.forEach(function(child) {
        decorateLevelData(child, data);
      });
    }
  }

  $.getJSON('level1.json').then(function(data) {
    decorateLevelData(data, null);
    React.render(
      <App levelData={data} />,
      mountNode
    );
  }).fail(function(err) {
    debugger;
  });

});