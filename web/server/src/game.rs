use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mark {
    X,
    O,
}

impl Mark {
    pub fn opposite(self) -> Self {
        match self {
            Mark::X => Mark::O,
            Mark::O => Mark::X,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Cell {
    #[default]
    Empty,
    X,
    O,
}

impl From<Mark> for Cell {
    fn from(mark: Mark) -> Self {
        match mark {
            Mark::X => Cell::X,
            Mark::O => Cell::O,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Winner {
    X,
    O,
    Draw,
}

impl From<Mark> for Winner {
    fn from(mark: Mark) -> Self {
        match mark {
            Mark::X => Winner::X,
            Mark::O => Winner::O,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TicTacToe {
    pub board: [Cell; 9],
    pub turn: Mark,
    pub winner: Option<Winner>,
    pub x_player_id: Uuid,
    pub o_player_id: Uuid,
}

impl TicTacToe {
    pub fn new(x_player_id: Uuid, o_player_id: Uuid) -> Self {
        Self {
            board: [Cell::Empty; 9],
            turn: Mark::X,
            winner: None,
            x_player_id,
            o_player_id,
        }
    }

    pub fn player_mark(&self, player_id: Uuid) -> Option<Mark> {
        if player_id == self.x_player_id {
            Some(Mark::X)
        } else if player_id == self.o_player_id {
            Some(Mark::O)
        } else {
            None
        }
    }

    pub fn place(&mut self, player_id: Uuid, index: u8) -> Result<(), &'static str> {
        if self.winner.is_some() {
            return Err("La partie est terminée");
        }
        let Some(mark) = self.player_mark(player_id) else {
            return Err("Tu n'es pas dans cette partie");
        };
        if mark != self.turn {
            return Err("Ce n'est pas ton tour");
        }
        if index > 8 {
            return Err("Case invalide");
        }
        if self.board[index as usize] != Cell::Empty {
            return Err("Case déjà prise");
        }

        self.board[index as usize] = mark.into();
        self.winner = check_winner(&self.board);
        if self.winner.is_none() {
            self.turn = self.turn.opposite();
        }
        Ok(())
    }

    pub fn reset(&mut self) {
        self.board = [Cell::Empty; 9];
        self.turn = Mark::X;
        self.winner = None;
    }
}

fn check_winner(board: &[Cell; 9]) -> Option<Winner> {
    const LINES: [[usize; 3]; 8] = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    for line in LINES {
        let a = board[line[0]];
        if a != Cell::Empty && a == board[line[1]] && a == board[line[2]] {
            return Some(match a {
                Cell::X => Winner::X,
                Cell::O => Winner::O,
                Cell::Empty => unreachable!(),
            });
        }
    }

    if board.iter().all(|c| *c != Cell::Empty) {
        Some(Winner::Draw)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_row_win() {
        let mut g = TicTacToe::new(Uuid::new_v4(), Uuid::new_v4());
        let x = g.x_player_id;
        let o = g.o_player_id;
        g.place(x, 0).unwrap();
        g.place(o, 3).unwrap();
        g.place(x, 1).unwrap();
        g.place(o, 4).unwrap();
        g.place(x, 2).unwrap();
        assert_eq!(g.winner, Some(Winner::X));
    }
}
