React.initializeTouchEvents(true);

$(function() {
  var mountNode = document.getElementById('app');

  var activeBoard = [];
  var i = 16;
  while (i--) {
    activeBoard.push(1);
  }

  var App = React.createClass({
    getInitialState: function() {
      return {
        activeBoard: activeBoard,
      };
    },
    
    render: function() {
      return <Board cells={this.state.activeBoard} />;
    },
  });

  var Cell = React.createClass({
    render: function() {
      return <div className="cell">
        <canvas className="cell-contents" width="100" height="100" />
      </div>;
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

  React.render(
    <App />,
    mountNode
  );
});