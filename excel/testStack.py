from queue import LifoQueue

class Stack:
    def __init__(self):
        self.stack = LifoQueue()

    def push(self, item):
        self.stack.put(item)

    def pop(self):
        return self.stack.get()

    def is_empty(self):
        return self.stack.empty()

    def size(self):
        return self.stack.qsize()
    def __repr__(self):
        return f"Stack({list(self.stack.queue)})"
    
session_id = 1
stack = Stack()

import json

# tree = json.load(open("/home/sanatu/Ars/excel/json/vatsakipu.json", "r"))
# tree = json.load(open("/home/sanatu/Ars/excel/json/kuume.json", "r"))
tree = json.load(open("/home/sanatu/Ars/excel/json/ulostaminen.json", "r"))
def test_tree_travesal(tree):
    for node in tree:
        stack.push(node)
        while not stack.is_empty():
            node = stack.pop()
            print(node["questionText"])
            if node["type"] != "ligert":
                answers = node["answers"]
                print("Answers:")
                for answer in answers:
                    print(answer["answerId"], ":", answer["answerText"])
                user_answer = input("Your answer: ")
                for answer in answers:
                    if answer["answerId"] == user_answer:
                        print(answer["answerText"])
                        if answer["question"] != []:
                            for question in answer["question"][::-1]:
                                if question["questionId"] != "":
                                    stack.push(question)
            else:
                ligert_range = range(1, 11)
                print("Answers:")
                for i in ligert_range:
                    print(i)
                user_answer = input("Your answer: ")
                answers = node["answers"]
                template_print_text = str(answers[0]["printText"])
                print_text = template_print_text.replace("__", user_answer)
                print(print_text)
                
    
test_tree_travesal(tree)

        
    
    
