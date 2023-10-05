package br.com.wsoubar.jubarte.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

import br.com.wsoubar.jubarte.model.Usuario;
import br.com.wsoubar.jubarte.service.UsuarioService;

@Controller
public class UsuarioController {
    
    @Autowired
    private UsuarioService usuarioService;

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("allUserList", usuarioService.getAllUsuarios());
        return "index";
    }

    @GetMapping("/add")
    public String addUsuario(Model model) {
        Usuario usu = new Usuario();
        model.addAttribute("usuario", usu);
        return "newUsuario";
    }

    @PostMapping("/save")
    public String save(@ModelAttribute("usuario")  Usuario usuario) {
        usuarioService.save(usuario);
        return "redirect:/";
    }    

    @GetMapping("/showForm/{id}")
    public String updateForm(@PathVariable(value = "id") Long id, Model model) {
        Usuario usu = usuarioService.getById(id);
        model.addAttribute("usuario", usu);
        return "update";
    }
 
    @GetMapping("/delete/{id}")
    public String delete(@PathVariable(value = "id") Long id) {
        usuarioService.deleteById(id);
        return "redirect:/";
 
    }
}
