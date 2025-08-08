from queue import LifoQueue

class Stack:
    """
    A simple stack implementation using LifoQueue from queue.
    
    Methods:
        push(item): Push an item onto the stack.
        pop(): Remove and return the top item from the stack.
        peek(): Return the top item without removing it.
        is_empty(): Check if the stack is empty.
        size(): Get the number of items in the stack.
        
    Attributes:
        stack (LifoQueue): The underlying stack storage.
    """
    def __init__(self):
        self.stack = LifoQueue()

    def push(self, item):
        """Push an item onto the stack"""
        self.stack.put(item)

    def pop(self):
        """Remove and return the top item from the stack"""
        return self.stack.get()
    
    def peek(self):
        """Return the top item without removing it."""
        if not self.is_empty():
            return self.stack.queue[-1]
        return None

    def is_empty(self):
        """Check if the stack is empty."""
        return self.stack.empty()

    def size(self):
        """Get the number of items in the stack."""
        return self.stack.qsize()
    
    def __repr__(self):
        return f"Stack({list(self.stack.queue)})"